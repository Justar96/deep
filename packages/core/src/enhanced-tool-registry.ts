// Enhanced Tool Registry - Sprint 2 implementation with confirmation system, risk assessment, and audit trail
import { EventEmitter } from 'eventemitter3'
import Ajv from 'ajv'
import { v4 as uuidv4 } from 'uuid'
import type {
  IToolRegistry,
  ToolSchema,
  ToolExecutionContext,
  ToolConfirmation,
  ToolImpactAnalysis,
  ToolAuditEntry,
  ToolPermissions,
  DeepConfig,
  DeepEvent
} from './types.js'
import { ToolConfirmationBus } from './tool-confirmation-bus.js'
import { ToolImpactAnalyzer } from './tool-impact-analyzer.js'
import { ToolAuditTrail } from './tool-audit-trail.js'

interface RegisteredTool {
  definition: any
  schema?: ToolSchema
  executor: (input: string, callId: string) => Promise<string>
  trusted: boolean
  permissions: ToolPermissions
}

export class EnhancedToolRegistry extends EventEmitter<{ event: (event: DeepEvent) => void }> implements IToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map()
  private confirmationBus: ToolConfirmationBus
  private impactAnalyzer: ToolImpactAnalyzer
  private auditTrail: ToolAuditTrail
  private schemaValidator: Ajv
  private config: DeepConfig
  private activeExecutions: Map<string, ToolExecutionContext> = new Map()
  private emergencyStopped: boolean = false

  constructor(config: DeepConfig) {
    super()
    this.config = config
    this.confirmationBus = new ToolConfirmationBus(config.tools.confirmationTimeoutMs)
    this.impactAnalyzer = new ToolImpactAnalyzer()
    this.auditTrail = new ToolAuditTrail({
      maxLogEntries: 10000,
      persistenceEnabled: config.tools.auditTrailEnabled
    })
    this.schemaValidator = new Ajv()

    this.initializeDefaultTools()
    this.setupEventHandlers()
  }

  getTools(trusted: boolean = true): any[] {
    const filteredTools: any[] = []

    for (const [name, tool] of this.tools.entries()) {
      if (tool.trusted === trusted || !trusted) {
        filteredTools.push(tool.definition)
      }
    }

    return filteredTools
  }

  async executeToolCall(name: string, input: string, callId: string): Promise<string> {
    if (this.emergencyStopped) {
      throw new Error('Tool execution is currently stopped due to emergency stop')
    }

    const tool = this.tools.get(name)
    if (!tool) {
      throw new Error(`Tool not found: ${name}`)
    }

    // Create execution context
    const context: ToolExecutionContext = {
      callId,
      approved: false,
      executionEnvironment: this.config.tools.sandboxingEnabled ? 'sandboxed' : 'direct',
      timeout: this.config.tools.executionTimeoutMs,
      affectedPaths: [],
      permissions: tool.permissions,
      metadata: {
        startTime: Date.now(),
        toolName: name,
        conversationId: this.getCurrentConversationId()
      }
    }

    this.activeExecutions.set(callId, context)
    const startTime = Date.now()

    try {
      // Emit execution start event
      this.emit('event', {
        type: 'tool_execution_start',
        data: { callId, context }
      })

      // Perform impact analysis
      const impact = await this.analyzeToolImpact(name, input)

      this.emit('event', {
        type: 'tool_impact_analysis',
        data: { callId, analysis: impact }
      })

      // Create confirmation request
      const confirmation = await this.impactAnalyzer.createToolConfirmation(
        name,
        input,
        callId,
        tool.schema
      )

      // Check if approval is required
      if (this.config.tools.confirmationEnabled && confirmation.requiresApproval) {
        // Auto-approval for low-risk operations if configured
        if (this.config.tools.autoApprovalForLowRisk &&
            this.confirmationBus.shouldAutoApprove(confirmation)) {
          context.approved = true

          this.emit('event', {
            type: 'tool_approved',
            data: { callId, approvalSource: 'auto' }
          })
        } else {
          // Request user approval
          this.emit('event', {
            type: 'tool_confirmation_request',
            data: { confirmation, timeoutMs: this.config.tools.confirmationTimeoutMs }
          })

          const approved = await this.requestApproval(confirmation)
          context.approved = approved

          if (approved) {
            this.emit('event', {
              type: 'tool_approved',
              data: { callId, approvalSource: 'user' }
            })
          } else {
            this.emit('event', {
              type: 'tool_denied',
              data: { callId, reason: 'User denied approval' }
            })

            throw new Error('Tool execution denied by user')
          }
        }
      } else {
        context.approved = true
      }

      // Validate input schema if available
      if (tool.schema && tool.schema.parameters) {
        const isValid = await this.validateToolSchema(tool.definition)
        if (!isValid) {
          throw new Error(`Invalid tool input schema for ${name}`)
        }

        // Validate input against schema
        const inputObj = JSON.parse(input)
        const validateInput = this.schemaValidator.compile(tool.schema.parameters)
        if (!validateInput(inputObj)) {
          throw new Error(`Invalid input for tool ${name}: ${this.schemaValidator.errorsText(validateInput.errors)}`)
        }
      }

      // Execute the tool with timeout
      const result = await Promise.race([
        tool.executor(input, callId),
        this.createTimeoutPromise(context.timeout)
      ])

      const executionTime = Date.now() - startTime
      const success = true

      // Log successful execution
      await this.auditTrail.logToolExecution(
        name,
        callId,
        this.getCurrentConversationId(),
        input,
        result,
        executionTime,
        success,
        undefined,
        confirmation.riskLevel,
        context.approved,
        context.approved ? (this.config.tools.autoApprovalForLowRisk && confirmation.riskLevel === 'low' ? 'auto' : 'user') : 'policy',
        impact
      )

      // Emit audit log event
      const auditEntries = this.auditTrail.getAuditTrail(1)
      const auditEntry = auditEntries[0]
      if (auditEntry) {
        this.emit('event', {
          type: 'tool_audit_log',
          data: { entry: auditEntry }
        })
      }

      return result

    } catch (error) {
      const executionTime = Date.now() - startTime
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'

      // Log failed execution
      await this.auditTrail.logToolExecution(
        name,
        callId,
        this.getCurrentConversationId(),
        input,
        '',
        executionTime,
        false,
        errorMsg,
        'high', // Failed executions are considered high risk
        context.approved,
        'user',
        await this.analyzeToolImpact(name, input)
      )

      throw error

    } finally {
      this.activeExecutions.delete(callId)
    }
  }

  async validateToolSchema(tool: any): Promise<boolean> {
    try {
      // Validate that tool has required fields
      if (!tool.type || !tool.name) {
        return false
      }

      // For function tools, validate parameters schema
      if (tool.type === 'function' && tool.parameters) {
        const validateSchema = this.schemaValidator.compile({
          type: 'object',
          properties: {
            type: { type: 'string' },
            properties: { type: 'object' },
            required: { type: 'array', items: { type: 'string' } }
          },
          required: ['type']
        })

        return validateSchema(tool.parameters)
      }

      return true
    } catch (error) {
      return false
    }
  }

  async analyzeToolImpact(toolName: string, input: string): Promise<ToolImpactAnalysis> {
    const tool = this.tools.get(toolName)
    return await this.impactAnalyzer.analyzeToolImpact(toolName, input, tool?.schema)
  }

  async requestApproval(confirmation: ToolConfirmation): Promise<boolean> {
    return await this.confirmationBus.requestApproval(confirmation, this.config.tools.confirmationTimeoutMs)
  }

  getAuditTrail(limit?: number): ToolAuditEntry[] {
    return this.auditTrail.getAuditTrail(limit)
  }

  async emergencyStop(): Promise<void> {
    this.emergencyStopped = true

    // Cancel all active executions
    const activeToolNames = Array.from(this.activeExecutions.values())
      .map(context => context.metadata?.toolName as string)
      .filter(Boolean)

    this.activeExecutions.clear()

    this.emit('event', {
      type: 'emergency_stop',
      data: {
        reason: 'Emergency stop activated',
        affectedTools: [...new Set(activeToolNames)]
      }
    })
  }

  // Enhanced registration with full Sprint 2 capabilities
  registerTool(
    tool: any,
    executor: (input: string, callId: string) => Promise<string>,
    trusted: boolean = true,
    schema?: ToolSchema
  ): void {
    if (!tool.name) {
      throw new Error('Tool must have a name')
    }

    // Analyze tool permissions and risk assessment
    const permissions = this.impactAnalyzer.getRequiredPermissions(tool.name, tool)
    const riskAssessment = this.impactAnalyzer.assessToolRisk(tool.name, tool)

    // Create full schema if not provided
    const fullSchema: ToolSchema = schema || {
      name: tool.name,
      version: '1.0.0',
      description: tool.description || 'No description provided',
      parameters: tool.parameters || {},
      returnType: { type: 'string' },
      riskAssessment,
      permissions
    }

    const registeredTool: RegisteredTool = {
      definition: tool,
      schema: fullSchema,
      executor,
      trusted,
      permissions
    }

    this.tools.set(tool.name, registeredTool)
  }

  // Batch tool operations
  async executeBatchToolCalls(
    calls: Array<{ name: string; input: string; callId: string }>
  ): Promise<Array<{ callId: string; result?: string; error?: string }>> {
    // Check concurrency limits
    if (calls.length > this.config.tools.maxConcurrentExecutions) {
      throw new Error(`Batch size ${calls.length} exceeds maximum allowed concurrent executions ${this.config.tools.maxConcurrentExecutions}`)
    }

    const results = await Promise.allSettled(
      calls.map(call =>
        this.executeToolCall(call.name, call.input, call.callId)
          .then(result => ({ callId: call.callId, result }))
          .catch(error => ({ callId: call.callId, error: error.message }))
      )
    )

    return results.map(result =>
      result.status === 'fulfilled' ? result.value : { callId: '', error: 'Execution failed' }
    )
  }

  // Tool management utilities
  getTool(name: string): RegisteredTool | undefined {
    return this.tools.get(name)
  }

  listToolNames(): string[] {
    return Array.from(this.tools.keys())
  }

  getToolsByPermission(permission: keyof ToolPermissions): string[] {
    return Array.from(this.tools.entries())
      .filter(([name, tool]) => tool.permissions[permission])
      .map(([name, tool]) => name)
  }

  getActiveExecutions(): ToolExecutionContext[] {
    return Array.from(this.activeExecutions.values())
  }

  // Security and monitoring
  getSecurityReport(): ReturnType<ToolAuditTrail['generateSecurityReport']> {
    return this.auditTrail.generateSecurityReport()
  }

  resetEmergencyStop(): void {
    this.emergencyStopped = false
  }

  private setupEventHandlers(): void {
    // Handle confirmation bus events
    this.confirmationBus.on('confirmation_request', (request) => {
      this.emit('event', {
        type: 'tool_confirmation_request',
        data: {
          confirmation: request.toolCall,
          timeoutMs: request.timeoutMs
        }
      })
    })

    this.confirmationBus.on('request_timeout', (requestId) => {
      // Handle timeout - could emit timeout event
    })
  }

  private initializeDefaultTools(): void {
    // Re-register the basic tools with enhanced capabilities
    this.registerTool(
      {
        type: 'function',
        name: 'get_current_time',
        description: 'Get the current time in ISO format',
        parameters: {
          type: 'object',
          properties: {
            timezone: {
              type: 'string',
              description: 'Timezone (e.g., UTC, America/New_York)',
            },
          },
          additionalProperties: false,
        },
      },
      async (input: string) => {
        const params = JSON.parse(input)
        const timezone = params.timezone || 'UTC'

        try {
          const date = new Date()
          const timeString = date.toLocaleString('en-US', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })

          return `Current time in ${timezone}: ${timeString}`
        } catch (error) {
          return `Error getting time for timezone ${timezone}: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      },
      true
    )

    // Enhanced echo tool with risk assessment
    this.registerTool(
      {
        type: 'function',
        name: 'echo_tool',
        description: 'Echoes back the input text with a prefix',
        parameters: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Text to echo back'
            }
          },
          required: ['text'],
          additionalProperties: false
        }
      },
      async (input: string) => {
        const params = JSON.parse(input)
        return `Echo: ${params.text}`
      },
      false // untrusted example
    )
  }

  private async createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Tool execution timed out after ${timeoutMs}ms`))
      }, timeoutMs)
    })
  }

  private getCurrentConversationId(): string {
    // In a real implementation, this would get the current conversation ID
    // For now, we'll return a placeholder
    return 'current-conversation'
  }
}