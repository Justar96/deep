// Tool Registry - Sprint 2 implementation with confirmation system, risk assessment, and audit trail
import { EventEmitter } from 'eventemitter3'
import Ajv, { type Ajv as AjvInstance } from 'ajv'
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
import { BaseToolRegistry, type BaseToolEntry } from './base-tool-registry.js'
import { ToolConfirmationBus } from './tool-confirmation-bus.js'
import { ToolImpactAnalyzer } from './tool-impact-analyzer.js'
import { ToolAuditTrail } from './tool-audit-trail.js'

interface ToolEntry extends BaseToolEntry {
  schema?: ToolSchema
  permissions: ToolPermissions
}

export class ToolRegistry extends EventEmitter<{ event: (event: DeepEvent) => void }> implements IToolRegistry {
  private baseRegistry: BaseToolRegistry
  private toolMetadata: Map<string, Omit<ToolEntry, keyof BaseToolEntry>> = new Map()
  private confirmationBus: ToolConfirmationBus
  private impactAnalyzer: ToolImpactAnalyzer
  private auditTrail: ToolAuditTrail
  private schemaValidator: AjvInstance
  private config: DeepConfig
  private activeExecutions: Map<string, ToolExecutionContext> = new Map()
  private emergencyStopped: boolean = false

  constructor(config: DeepConfig) {
    super()
    this.config = config
    this.baseRegistry = new BaseToolRegistry()
    this.confirmationBus = new ToolConfirmationBus(config.tools.confirmationTimeoutMs)
    this.impactAnalyzer = new ToolImpactAnalyzer()
    this.auditTrail = new ToolAuditTrail({
      maxLogEntries: 10000,
      persistenceEnabled: config.tools.auditTrailEnabled
    })
    this.schemaValidator = new Ajv()

    this.setupEventHandlers()
    this.initializeEnhancedMetadata()
  }

  getTools(trusted: boolean = true): any[] {
    return this.baseRegistry.getTools(trusted)
  }

  async executeToolCall(name: string, input: string, callId: string): Promise<string> {
    if (this.emergencyStopped) {
      throw new Error('Tool execution is currently stopped due to emergency stop')
    }

    const baseEntry = this.baseRegistry.getToolEntry(name)
    if (!baseEntry) {
      throw new Error(`Tool not found: ${name}`)
    }

    const toolMetadata = this.toolMetadata.get(name)
    const tool = toolMetadata ? { ...baseEntry, ...toolMetadata } : {
      ...baseEntry,
      permissions: this.impactAnalyzer.getRequiredPermissions(name, baseEntry.definition),
      schema: undefined
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

      // Check if confirmation system is enabled
      if (this.config.tools.confirmationEnabled) {
        // Auto-approval for low-risk operations if configured
        if (this.config.tools.autoApprovalForLowRisk &&
            this.confirmationBus.shouldAutoApprove(confirmation)) {
          context.approved = true

          this.emit('event', {
            type: 'tool_approved',
            data: { callId, approvalSource: 'auto' }
          })
        } else if (confirmation.requiresApproval) {
          // Request user approval for operations that require it
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
        } else {
          // Low-risk operations that don't require approval - approve silently
          context.approved = true
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
        this.baseRegistry.executeToolCallWithThrow(name, input, callId),
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
    const toolMetadata = this.toolMetadata.get(toolName)
    return await this.impactAnalyzer.analyzeToolImpact(toolName, input, toolMetadata?.schema)
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

    // Register with basic registry first
    this.baseRegistry.registerTool(tool, executor, trusted)

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

    // Store enhanced metadata
    this.toolMetadata.set(tool.name, {
      schema: fullSchema,
      permissions
    })
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
  getTool(name: string): EnhancedToolEntry | undefined {
    const baseEntry = this.baseRegistry.getToolEntry(name)
    if (!baseEntry) return undefined

    const toolMetadata = this.toolMetadata.get(name)
    if (toolMetadata) {
      return { ...baseEntry, ...toolMetadata }
    } else {
      const permissions = this.impactAnalyzer.getRequiredPermissions(name, baseEntry.definition)
      return {
        ...baseEntry,
        permissions
      } as ToolEntry
    }
  }

  listToolNames(): string[] {
    return this.baseRegistry.getAllTools().map(entry => entry.definition.name)
  }

  getToolsByPermission(permission: keyof ToolPermissions): string[] {
    const results: string[] = []
    const baseTools = this.baseRegistry.getAllTools()

    for (const baseTool of baseTools) {
      const toolMetadata = this.toolMetadata.get(baseTool.definition.name)
      const permissions = toolMetadata?.permissions ||
        this.impactAnalyzer.getRequiredPermissions(baseTool.definition.name, baseTool.definition)

      if (permissions[permission]) {
        results.push(baseTool.definition.name)
      }
    }

    return results
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

  private initializeEnhancedMetadata(): void {
    // Add enhanced metadata for default tools from basic registry
    const baseTools = this.baseRegistry.getAllTools()

    for (const baseTool of baseTools) {
      if (!this.toolMetadata.has(baseTool.definition.name)) {
        const permissions = this.impactAnalyzer.getRequiredPermissions(
          baseTool.definition.name,
          baseTool.definition
        )
        const riskAssessment = this.impactAnalyzer.assessToolRisk(
          baseTool.definition.name,
          baseTool.definition
        )

        const schema: ToolSchema = {
          name: baseTool.definition.name,
          version: '1.0.0',
          description: baseTool.definition.description || 'No description provided',
          parameters: baseTool.definition.parameters || {},
          returnType: { type: 'string' },
          riskAssessment,
          permissions
        }

        this.toolMetadata.set(baseTool.definition.name, {
          schema,
          permissions
        })
      }
    }
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