// Test suite for Enhanced Tool Registry - Sprint 2 Enhanced Tool System Integration
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { EnhancedToolRegistry } from '@deep-agent/core'
import type { DeepConfig, DeepEvent, ToolConfirmation } from '@deep-agent/core'

describe('EnhancedToolRegistry', () => {
  let registry: EnhancedToolRegistry
  let mockConfig: DeepConfig
  const events: DeepEvent[] = []

  beforeEach(() => {
    events.length = 0
    mockConfig = {
      apiKey: 'test-api-key',
      baseUrl: null,
      model: 'gpt-4o',
      useResponsesDefault: true,
      stream: true,
      store: true,
      verbosity: 'medium',
      reasoningEffort: 'medium',
      enableSummary: false,
      includeEncrypted: false,
      allowedTools: [],
      logPaths: false,
      conversation: {
        compression: {
          enabled: true,
          threshold: 0.7,
          strategy: 'summarize',
          preserveContext: true,
          maxCompressionRatio: 0.3,
        },
        maxTokens: 8000,
        curationEnabled: true,
        healthCheckInterval: 30,
      },
      tools: {
        confirmationEnabled: true,
        confirmationTimeoutMs: 5000,
        autoApprovalForLowRisk: true,
        auditTrailEnabled: true,
        sandboxingEnabled: false,
        emergencyStopEnabled: true,
        maxConcurrentExecutions: 5,
        executionTimeoutMs: 30000,
      }
    }

    registry = new EnhancedToolRegistry(mockConfig)

    // Capture events
    registry.on('event', (event) => {
      events.push(event)
    })
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Basic Functionality', () => {
    it('should create enhanced tool registry', () => {
      expect(registry).toBeDefined()
      expect(registry).toBeInstanceOf(EnhancedToolRegistry)
    })

    it('should initialize with default tools', () => {
      const tools = registry.getTools(true)
      expect(tools.length).toBeGreaterThan(0)

      const toolNames = tools.map(tool => tool.name)
      expect(toolNames).toContain('get_current_time')
    })

    it('should separate trusted and untrusted tools', () => {
      const trustedTools = registry.getTools(true)
      const untrustedTools = registry.getTools(false)

      expect(trustedTools.length).toBeGreaterThan(0)
      expect(untrustedTools.length).toBeGreaterThan(0)

      // Check that echo_tool is in untrusted
      const untrustedNames = untrustedTools.map(tool => tool.name)
      expect(untrustedNames).toContain('echo_tool')
    })
  })

  describe('Tool Registration', () => {
    it('should register new tool', () => {
      const testTool = {
        type: 'function',
        name: 'test_tool',
        description: 'Test tool for unit tests',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          },
          required: ['input']
        }
      }

      const executor = vi.fn().mockResolvedValue('test result')

      registry.registerTool(testTool, executor, true)

      const tools = registry.getTools(true)
      const toolNames = tools.map(tool => tool.name)
      expect(toolNames).toContain('test_tool')
    })

    it('should throw error for tool without name', () => {
      const invalidTool = {
        type: 'function',
        description: 'Tool without name'
      }

      const executor = vi.fn()

      expect(() => {
        registry.registerTool(invalidTool, executor, true)
      }).toThrow('Tool must have a name')
    })

    it('should analyze permissions when registering tool', () => {
      const fileTool = {
        type: 'function',
        name: 'read_file',
        description: 'Read file contents from disk',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' }
          }
        }
      }

      const executor = vi.fn()
      registry.registerTool(fileTool, executor, true)

      const tool = registry.getTool('read_file')
      expect(tool?.permissions.fileRead).toBe(true)
      expect(tool?.permissions.fileWrite).toBe(false)
    })
  })

  describe('Tool Execution with Confirmation', () => {
    const createTestTool = (riskLevel: 'low' | 'medium' | 'high') => {
      const toolName = `${riskLevel}_risk_tool`
      const description = riskLevel === 'high' ? 'Delete important files' :
                         riskLevel === 'medium' ? 'Write to files' :
                         'Read safe data'

      return {
        type: 'function',
        name: toolName,
        description,
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          }
        }
      }
    }

    it('should execute low-risk tool without confirmation', async () => {
      const lowRiskTool = createTestTool('low')
      const executor = vi.fn().mockResolvedValue('low risk result')

      registry.registerTool(lowRiskTool, executor, true)

      const result = await registry.executeToolCall(
        'low_risk_tool',
        JSON.stringify({ input: 'test' }),
        'call-123'
      )

      expect(result).toBe('low risk result')
      expect(executor).toHaveBeenCalled()
    })

    it('should request confirmation for high-risk tool', async () => {
      const config = { ...mockConfig }
      config.tools.confirmationEnabled = true
      config.tools.autoApprovalForLowRisk = false

      const testRegistry = new EnhancedToolRegistry(config)
      const events: DeepEvent[] = []
      testRegistry.on('event', (event) => events.push(event))

      const highRiskTool = createTestTool('high')
      const executor = vi.fn().mockResolvedValue('high risk result')

      testRegistry.registerTool(highRiskTool, executor, true)

      // Set up auto-approval for testing
      testRegistry.on('event', (event) => {
        if (event.type === 'tool_confirmation_request') {
          setTimeout(() => {
            // Access private confirmation bus through registry internals
            const confirmationBus = (testRegistry as any).confirmationBus
            const pendingRequests = confirmationBus.getPendingRequests()
            if (pendingRequests.length > 0) {
              confirmationBus.approveRequest(pendingRequests[0].id, 'Test approval')
            }
          }, 10)
        }
      })

      const result = await testRegistry.executeToolCall(
        'high_risk_tool',
        JSON.stringify({ input: 'test' }),
        'call-456'
      )

      expect(result).toBe('high risk result')

      // Check that confirmation was requested
      const confirmationEvents = events.filter(e => e.type === 'tool_confirmation_request')
      expect(confirmationEvents.length).toBeGreaterThan(0)

      const approvalEvents = events.filter(e => e.type === 'tool_approved')
      expect(approvalEvents.length).toBeGreaterThan(0)
    })

    it('should deny execution when confirmation is denied', async () => {
      const config = { ...mockConfig }
      config.tools.confirmationEnabled = true
      config.tools.autoApprovalForLowRisk = false

      const testRegistry = new EnhancedToolRegistry(config)

      const highRiskTool = createTestTool('high')
      const executor = vi.fn().mockResolvedValue('should not execute')

      testRegistry.registerTool(highRiskTool, executor, true)

      // Set up auto-denial
      testRegistry.on('event', (event) => {
        if (event.type === 'tool_confirmation_request') {
          setTimeout(() => {
            const confirmationBus = (testRegistry as any).confirmationBus
            const pendingRequests = confirmationBus.getPendingRequests()
            if (pendingRequests.length > 0) {
              confirmationBus.denyRequest(pendingRequests[0].id, 'Test denial')
            }
          }, 10)
        }
      })

      await expect(
        testRegistry.executeToolCall(
          'high_risk_tool',
          JSON.stringify({ input: 'test' }),
          'call-789'
        )
      ).rejects.toThrow('Tool execution denied by user')

      expect(executor).not.toHaveBeenCalled()
    })

    it('should auto-approve low-risk operations when configured', async () => {
      const config = { ...mockConfig }
      config.tools.confirmationEnabled = true
      config.tools.autoApprovalForLowRisk = true

      const testRegistry = new EnhancedToolRegistry(config)
      const events: DeepEvent[] = []
      testRegistry.on('event', (event) => events.push(event))

      const lowRiskTool = createTestTool('low')
      const executor = vi.fn().mockResolvedValue('auto approved')

      testRegistry.registerTool(lowRiskTool, executor, true)

      const result = await testRegistry.executeToolCall(
        'low_risk_tool',
        JSON.stringify({ input: 'test' }),
        'call-auto'
      )

      expect(result).toBe('auto approved')

      // Should have auto-approval event
      const autoApprovals = events.filter(e =>
        e.type === 'tool_approved' && e.data.approvalSource === 'auto'
      )
      expect(autoApprovals.length).toBeGreaterThan(0)
    })
  })

  describe('Schema Validation', () => {
    it('should validate tool schema', async () => {
      const validTool = {
        type: 'function',
        name: 'valid_tool',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          }
        }
      }

      const isValid = await registry.validateToolSchema(validTool)
      expect(isValid).toBe(true)
    })

    it('should reject invalid tool schema', async () => {
      const invalidTool = {
        name: 'invalid_tool'
        // Missing type and other required fields
      }

      const isValid = await registry.validateToolSchema(invalidTool)
      expect(isValid).toBe(false)
    })

    it('should validate input against tool parameter schema', async () => {
      const strictTool = {
        type: 'function',
        name: 'strict_tool',
        description: 'Tool with strict parameter validation',
        parameters: {
          type: 'object',
          properties: {
            requiredParam: { type: 'string' },
            optionalParam: { type: 'number' }
          },
          required: ['requiredParam'],
          additionalProperties: false
        }
      }

      const executor = vi.fn().mockResolvedValue('validated')
      registry.registerTool(strictTool, executor, true)

      // Valid input should work
      const validInput = JSON.stringify({ requiredParam: 'test' })
      const result = await registry.executeToolCall('strict_tool', validInput, 'call-valid')
      expect(result).toBe('validated')

      // Invalid input should throw
      const invalidInput = JSON.stringify({ wrongParam: 'test' })
      await expect(
        registry.executeToolCall('strict_tool', invalidInput, 'call-invalid')
      ).rejects.toThrow('Invalid input')
    })
  })

  describe('Impact Analysis', () => {
    it('should analyze tool impact', async () => {
      const writeTool = {
        type: 'function',
        name: 'write_file',
        description: 'Write content to a file'
      }

      registry.registerTool(writeTool, vi.fn(), true)

      const impact = await registry.analyzeToolImpact(
        'write_file',
        JSON.stringify({ path: '/tmp/test.txt', content: 'test' })
      )

      expect(impact.operationType).toBe('write')
      expect(impact.filesAffected).toContain('/tmp/test.txt')
      expect(impact.reversible).toBe(true) // Creating new files is usually reversible
    })

    it('should emit impact analysis events', async () => {
      const testTool = {
        type: 'function',
        name: 'analyze_test',
        description: 'Tool for testing impact analysis'
      }

      const executor = vi.fn().mockResolvedValue('analyzed')
      registry.registerTool(testTool, executor, true)

      await registry.executeToolCall(
        'analyze_test',
        JSON.stringify({ data: 'test' }),
        'call-impact'
      )

      const impactEvents = events.filter(e => e.type === 'tool_impact_analysis')
      expect(impactEvents.length).toBeGreaterThan(0)
      expect(impactEvents[0].data.callId).toBe('call-impact')
      expect(impactEvents[0].data.analysis).toBeDefined()
    })
  })

  describe('Audit Trail', () => {
    it('should log successful tool executions', async () => {
      const executor = vi.fn().mockResolvedValue('success')
      const testTool = {
        type: 'function',
        name: 'audit_test',
        description: 'Tool for audit testing'
      }

      registry.registerTool(testTool, executor, true)

      await registry.executeToolCall(
        'audit_test',
        JSON.stringify({ test: 'data' }),
        'call-audit'
      )

      const auditTrail = registry.getAuditTrail(10)
      expect(auditTrail.length).toBeGreaterThan(0)

      const entry = auditTrail[0]
      expect(entry.toolName).toBe('audit_test')
      expect(entry.callId).toBe('call-audit')
      expect(entry.success).toBe(true)
      expect(entry.input).toBe('{"test":"data"}')
      expect(entry.output).toBe('success')
    })

    it('should log failed tool executions', async () => {
      const executor = vi.fn().mockRejectedValue(new Error('Test failure'))
      const testTool = {
        type: 'function',
        name: 'failing_tool',
        description: 'Tool that fails for testing'
      }

      registry.registerTool(testTool, executor, true)

      await expect(
        registry.executeToolCall(
          'failing_tool',
          JSON.stringify({ test: 'data' }),
          'call-fail'
        )
      ).rejects.toThrow('Test failure')

      const auditTrail = registry.getAuditTrail(10)
      const failedEntry = auditTrail.find(entry => entry.callId === 'call-fail')

      expect(failedEntry).toBeDefined()
      expect(failedEntry!.success).toBe(false)
      expect(failedEntry!.error).toBe('Test failure')
    })

    it('should emit audit log events', async () => {
      const executor = vi.fn().mockResolvedValue('logged')
      const testTool = {
        type: 'function',
        name: 'log_test',
        description: 'Tool for log event testing'
      }

      registry.registerTool(testTool, executor, true)

      await registry.executeToolCall(
        'log_test',
        JSON.stringify({ test: 'event' }),
        'call-log'
      )

      const logEvents = events.filter(e => e.type === 'tool_audit_log')
      expect(logEvents.length).toBeGreaterThan(0)
      expect(logEvents[0].data.entry.toolName).toBe('log_test')
    })
  })

  describe('Emergency Stop', () => {
    it('should stop all tool executions on emergency stop', async () => {
      const slowExecutor = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('slow'), 1000))
      )

      const testTool = {
        type: 'function',
        name: 'slow_tool',
        description: 'Slow tool for emergency stop testing'
      }

      registry.registerTool(testTool, slowExecutor, true)

      // Start execution but trigger emergency stop
      const executionPromise = registry.executeToolCall(
        'slow_tool',
        JSON.stringify({ data: 'test' }),
        'call-emergency'
      )

      // Trigger emergency stop
      await registry.emergencyStop()

      // New executions should be blocked
      await expect(
        registry.executeToolCall(
          'slow_tool',
          JSON.stringify({ data: 'test' }),
          'call-blocked'
        )
      ).rejects.toThrow('Tool execution is currently stopped')

      // Check emergency stop event
      const emergencyEvents = events.filter(e => e.type === 'emergency_stop')
      expect(emergencyEvents.length).toBeGreaterThan(0)
      expect(emergencyEvents[0].data.reason).toBe('Emergency stop activated')
    })

    it('should reset emergency stop', async () => {
      await registry.emergencyStop()

      // Should be blocked initially
      await expect(
        registry.executeToolCall(
          'get_current_time',
          JSON.stringify({ timezone: 'UTC' }),
          'call-blocked'
        )
      ).rejects.toThrow('Tool execution is currently stopped')

      // Reset emergency stop
      registry.resetEmergencyStop()

      // Should work again
      const result = await registry.executeToolCall(
        'get_current_time',
        JSON.stringify({ timezone: 'UTC' }),
        'call-reset'
      )

      expect(result).toContain('Current time in UTC')
    })
  })

  describe('Batch Operations', () => {
    beforeEach(() => {
      const batchTool = {
        type: 'function',
        name: 'batch_tool',
        description: 'Tool for batch testing'
      }

      const executor = vi.fn()
        .mockResolvedValueOnce('result1')
        .mockResolvedValueOnce('result2')
        .mockRejectedValueOnce(new Error('batch error'))

      registry.registerTool(batchTool, executor, true)
    })

    it('should execute batch tool calls', async () => {
      const calls = [
        { name: 'batch_tool', input: '{"test": 1}', callId: 'batch1' },
        { name: 'batch_tool', input: '{"test": 2}', callId: 'batch2' },
        { name: 'batch_tool', input: '{"test": 3}', callId: 'batch3' }
      ]

      const results = await registry.executeBatchToolCalls(calls)

      expect(results).toHaveLength(3)
      expect(results[0].result).toBe('result1')
      expect(results[1].result).toBe('result2')
      expect(results[2].error).toBe('batch error')
    })

    it('should respect concurrency limits', async () => {
      const largeBatch = Array.from({ length: 10 }, (_, i) => ({
        name: 'batch_tool',
        input: `{"test": ${i}}`,
        callId: `batch-${i}`
      }))

      await expect(
        registry.executeBatchToolCalls(largeBatch)
      ).rejects.toThrow('exceeds maximum allowed concurrent executions')
    })
  })

  describe('Tool Management Utilities', () => {
    it('should get registered tool information', () => {
      const tool = registry.getTool('get_current_time')
      expect(tool).toBeDefined()
      expect(tool!.definition.name).toBe('get_current_time')
      expect(tool!.trusted).toBe(true)
    })

    it('should list all tool names', () => {
      const toolNames = registry.listToolNames()
      expect(toolNames).toContain('get_current_time')
      expect(toolNames).toContain('echo_tool')
    })

    it('should get tools by permission', () => {
      // Register a file tool
      const fileTool = {
        type: 'function',
        name: 'file_reader',
        description: 'Read files'
      }
      registry.registerTool(fileTool, vi.fn(), true)

      const fileReadTools = registry.getToolsByPermission('fileRead')
      expect(fileReadTools).toContain('file_reader')
    })

    it('should track active executions', async () => {
      const slowTool = {
        type: 'function',
        name: 'slow_execution',
        description: 'Tool with slow execution'
      }

      const executor = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('done'), 100))
      )

      registry.registerTool(slowTool, executor, true)

      const executionPromise = registry.executeToolCall(
        'slow_execution',
        '{}',
        'slow-call'
      )

      // Check active executions
      const activeExecutions = registry.getActiveExecutions()
      expect(activeExecutions.length).toBeGreaterThan(0)
      expect(activeExecutions[0].callId).toBe('slow-call')

      await executionPromise

      // Should be empty after completion
      const completedExecutions = registry.getActiveExecutions()
      expect(completedExecutions).toHaveLength(0)
    })
  })

  describe('Security Report', () => {
    it('should generate security report', async () => {
      // Execute some tools to generate data
      await registry.executeToolCall('get_current_time', '{"timezone": "UTC"}', 'safe-call')

      const report = registry.getSecurityReport()

      expect(report.summary).toContain('Total Executions:')
      expect(report.riskScore).toBeGreaterThanOrEqual(0)
      expect(report.riskScore).toBeLessThanOrEqual(100)
      expect(Array.isArray(report.alerts)).toBe(true)
      expect(Array.isArray(report.recommendations)).toBe(true)
    })
  })
})