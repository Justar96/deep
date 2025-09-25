// Comprehensive tests for DeepEngine - main orchestrator
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { DeepConfig, DeepEvent, ConversationState } from '@deep-agent/core'

// Create fresh mock configuration for each test to ensure isolation
const createMockConfig = (): DeepConfig => ({
  apiKey: 'test-api-key',
  model: 'gpt-5',
  baseUrl: null,
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
      maxCompressionRatio: 0.3
    },
    maxTokens: 8000,
    curationEnabled: true,
    healthCheckInterval: 30
  }
})

// Mock counter for UUID to ensure uniqueness across tests
let uuidCounter = 0
const getTestUUID = () => `test-uuid-${++uuidCounter}`

// Dynamic import to ensure fresh module state for each test
let DeepEngine: any = null

describe('DeepEngine', () => {
  let engine: InstanceType<typeof DeepEngine>
  let mockResponseClient: any
  let mockConversationManager: any
  let mockToolRegistry: any
  let mockConfig: DeepConfig

  beforeEach(async () => {
    // Clear all mocks and reset module registry for isolation
    vi.resetAllMocks()
    vi.resetModules()

    // Create fresh mock configuration for each test
    mockConfig = createMockConfig()

    // Setup fresh mocks for each test run
    vi.doMock('openai', () => ({
      OpenAI: vi.fn().mockImplementation(() => ({
        responses: { create: vi.fn() },
        chat: { completions: { create: vi.fn() } }
      }))
    }))

    vi.doMock('uuid', () => ({
      v4: vi.fn(() => getTestUUID())
    }))

    // Dynamic import to get fresh instance
    const deepEngineModule = await import('@deep-agent/core')
    DeepEngine = deepEngineModule.DeepEngine

    // Create fresh engine instance
    engine = new DeepEngine(mockConfig)

    // Create fresh mocks for internal components with isolation
    mockResponseClient = {
      create: vi.fn().mockResolvedValue({
        id: `test-response-${uuidCounter}`,
        output: { type: 'text', text: 'test' }
      })
    }

    mockConversationManager = {
      get: vi.fn(),
      list: vi.fn(),
      delete: vi.fn(),
      initializeCompressionService: vi.fn()
    }

    mockToolRegistry = {
      getTools: vi.fn().mockReturnValue([]),
      registerTool: vi.fn()
    }

    // Replace internal components with isolated mocks
    ;(engine as any).responseClient = mockResponseClient
    ;(engine as any).conversationManager = mockConversationManager
    ;(engine as any).toolRegistry = mockToolRegistry
  })

  afterEach(() => {
    // Clean up and ensure proper isolation
    vi.clearAllMocks()
    vi.unstubAllGlobals()

    // Reset counters for next test
    if (uuidCounter > 1000) {
      uuidCounter = 0 // Reset to prevent overflow in long test runs
    }
  })

  describe('constructor', () => {
    it('should initialize with config', () => {
      expect(engine).toBeInstanceOf(DeepEngine)
      expect(engine.getConfig()).toEqual(mockConfig)
    })

    it('should handle custom base URL', () => {
      const customConfig = { ...mockConfig, baseUrl: 'https://custom-api.com' }
      const customEngine = new DeepEngine(customConfig)
      expect(customEngine.getConfig().baseUrl).toBe('https://custom-api.com')
    })
  })

  describe('processMessage', () => {
    beforeEach(() => {
      // Mock Turn class by replacing the processMessage method
      const mockEvents = [
        { type: 'turn_start', conversationId: 'test-uuid-1234' },
        { type: 'response_start', responseId: 'resp-123' },
        { type: 'content_delta', delta: 'Hello' },
        { type: 'turn_complete', conversationId: 'test-uuid-1234' }
      ]

      vi.spyOn(engine, 'processMessage').mockImplementation(async function* () {
        for (const event of mockEvents) {
          yield event as DeepEvent
        }
      })
    })

    it('should process message and yield events', async () => {
      const events: DeepEvent[] = []

      for await (const event of engine.processMessage('Hello, world!')) {
        events.push(event)
      }

      expect(events).toHaveLength(4)
      expect(events[0].type).toBe('turn_start')
      expect(events[3].type).toBe('turn_complete')
    })
  })

  describe('conversation management', () => {
    // Create mock conversation dynamically to avoid config reference issues
    const createMockConversation = (config: DeepConfig): ConversationState => ({
      id: 'conv-123',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      lastResponseId: null,
      metrics: {
        tokenUsage: { input: 100, output: 50, total: 150 },
        turnCount: 1,
        toolCallCount: 0,
        compressionEvents: 0
      },
      compression: config.conversation.compression,
      health: {
        isValid: true,
        hasInvalidResponses: false,
        continuityScore: 1.0,
        issues: []
      }
    })

    describe('getConversation', () => {
      it('should return conversation from manager', async () => {
        const mockConversation = createMockConversation(mockConfig)
        mockConversationManager.get.mockResolvedValue(mockConversation)

        const result = await engine.getConversation('conv-123')

        expect(mockConversationManager.get).toHaveBeenCalledWith('conv-123')
        expect(result).toBe(mockConversation)
      })

      it('should return null for non-existent conversation', async () => {
        mockConversationManager.get.mockResolvedValue(null)

        const result = await engine.getConversation('non-existent')

        expect(result).toBeNull()
      })
    })

    describe('listConversations', () => {
      it('should return list from conversation manager', async () => {
        const mockConversation = createMockConversation(mockConfig)
        const mockConversations = [mockConversation]
        mockConversationManager.list.mockResolvedValue(mockConversations)

        const result = await engine.listConversations()

        expect(mockConversationManager.list).toHaveBeenCalled()
        expect(result).toBe(mockConversations)
      })

      it('should return empty array when no conversations exist', async () => {
        mockConversationManager.list.mockResolvedValue([])

        const result = await engine.listConversations()

        expect(result).toEqual([])
      })
    })

    describe('clearConversation', () => {
      it('should delete conversation through manager', async () => {
        await engine.clearConversation('conv-123')

        expect(mockConversationManager.delete).toHaveBeenCalledWith('conv-123')
      })
    })
  })

  describe('tool filtering', () => {
    beforeEach(() => {
      mockToolRegistry.getTools.mockReturnValue([
        { type: 'function', name: 'web_search' },
        { type: 'function', name: 'file_read' },
        { type: 'function', name: 'execute_code' },
        { type: 'special', name: 'custom_tool' }
      ])
    })

    it('should return all tools when no filter configured', () => {
      const result = (engine as any).getFilteredTools()

      expect(mockToolRegistry.getTools).toHaveBeenCalledWith(true)
      expect(result).toHaveLength(4)
    })

    it('should filter tools by name when allowedTools is configured', () => {
      engine.updateConfig({ allowedTools: ['web_search', 'file_read'] })

      const result = (engine as any).getFilteredTools()

      expect(result).toHaveLength(2)
      expect(result.find((t: any) => t.name === 'web_search')).toBeTruthy()
      expect(result.find((t: any) => t.name === 'file_read')).toBeTruthy()
      expect(result.find((t: any) => t.name === 'execute_code')).toBeFalsy()
    })

    it('should filter tools by type when tool has no name', () => {
      engine.updateConfig({ allowedTools: ['special'] })

      const result = (engine as any).getFilteredTools()

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('special')
    })

    it('should return empty array when no allowed tools match', () => {
      engine.updateConfig({ allowedTools: ['non_existent_tool'] })

      const result = (engine as any).getFilteredTools()

      expect(result).toHaveLength(0)
    })
  })

  describe('configuration management', () => {
    describe('getConfig', () => {
      it('should return a copy of current config', () => {
        const result = engine.getConfig()

        expect(result).toEqual(mockConfig)
        expect(result).not.toBe(mockConfig) // Should be a copy
      })
    })

    describe('updateConfig', () => {
      it('should update config properties', () => {
        const updates = {
          model: 'gpt-4o',
          verbosity: 'high' as const
        }

        engine.updateConfig(updates)

        const newConfig = engine.getConfig()
        expect(newConfig.model).toBe('gpt-4o')
        expect(newConfig.verbosity).toBe('high')
        expect(newConfig.apiKey).toBe('test-api-key') // Unchanged
      })

      it('should update conversation manager when API settings change', () => {
        const updates = {
          apiKey: 'new-api-key',
          baseUrl: 'https://new-api.com'
        }

        engine.updateConfig(updates)

        expect(mockConversationManager.initializeCompressionService)
          .toHaveBeenCalledWith(expect.any(Object), expect.objectContaining(updates))
      })

      it('should handle partial config updates', () => {
        engine.updateConfig({ model: 'gpt-5-mini' })

        const config = engine.getConfig()
        expect(config.model).toBe('gpt-5-mini')
        expect(config.apiKey).toBe('test-api-key') // Unchanged
      })
    })
  })

  describe('tool management', () => {
    describe('registerTool', () => {
      it('should register tool with executor and trusted flag', () => {
        const mockTool = { name: 'test_tool', description: 'Test tool' }
        const mockExecutor = vi.fn().mockResolvedValue('test result')

        engine.registerTool(mockTool, mockExecutor, true)

        expect(mockToolRegistry.registerTool).toHaveBeenCalledWith(
          mockTool,
          mockExecutor,
          true
        )
      })

      it('should default trusted to true when not specified', () => {
        const mockTool = { name: 'test_tool' }
        const mockExecutor = vi.fn()

        engine.registerTool(mockTool, mockExecutor)

        expect(mockToolRegistry.registerTool).toHaveBeenCalledWith(
          mockTool,
          mockExecutor,
          true
        )
      })

      it('should handle untrusted tools', () => {
        const mockTool = { name: 'unsafe_tool' }
        const mockExecutor = vi.fn()

        engine.registerTool(mockTool, mockExecutor, false)

        expect(mockToolRegistry.registerTool).toHaveBeenCalledWith(
          mockTool,
          mockExecutor,
          false
        )
      })
    })
  })

  describe('healthCheck', () => {
    it('should return ok status when API is accessible', async () => {
      mockResponseClient.create.mockResolvedValue({
        id: 'resp-123',
        output: { type: 'text', text: 'ok' }
      })

      const result = await engine.healthCheck()

      expect(mockResponseClient.create).toHaveBeenCalledWith({
        model: 'gpt-5',
        input: 'test',
        max_output_tokens: 1,
      })

      expect(result).toEqual({ status: 'ok' })
    })

    it('should return error status when API is not accessible', async () => {
      const mockError = new Error('API connection failed')
      mockResponseClient.create.mockRejectedValue(mockError)

      const result = await engine.healthCheck()

      expect(result).toEqual({
        status: 'error',
        message: 'API connection failed'
      })
    })

    it('should handle unknown error types', async () => {
      mockResponseClient.create.mockRejectedValue('string error')

      const result = await engine.healthCheck()

      expect(result).toEqual({
        status: 'error',
        message: 'Unknown error'
      })
    })

    it('should use current model in health check', async () => {
      engine.updateConfig({ model: 'gpt-4o' })
      mockResponseClient.create.mockResolvedValue({ id: 'resp-123' })

      await engine.healthCheck()

      expect(mockResponseClient.create).toHaveBeenCalledWith({
        model: 'gpt-4o',
        input: 'test',
        max_output_tokens: 1,
      })
    })
  })

  describe('processMessageStream', () => {
    it('should delegate to processMessage', async () => {
      const mockEvents = [
        { type: 'turn_start', conversationId: 'test' } as DeepEvent,
        { type: 'turn_complete', conversationId: 'test' } as DeepEvent
      ]

      // Mock processMessage generator
      vi.spyOn(engine, 'processMessage').mockImplementation(async function* () {
        for (const event of mockEvents) {
          yield event
        }
      })

      const events: DeepEvent[] = []
      for await (const event of engine.processMessageStream('Hello', 'test-conv')) {
        events.push(event)
      }

      expect(engine.processMessage).toHaveBeenCalledWith('Hello', 'test-conv')
      expect(events).toEqual(mockEvents)
    })
  })
})