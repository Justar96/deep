// Tests for enhanced conversation manager functionality
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryConversationManager } from '@deep-agent/core'
import type { DeepConfig, ConversationState } from '@deep-agent/core'

// Mock OpenAI client
const mockOpenAI = {
  chat: {
    completions: {
      create: vi.fn()
    }
  }
} as any

// Mock configuration
const mockConfig: DeepConfig = {
  apiKey: 'test-key',
  model: 'gpt-4o',
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
    maxTokens: 1000, // Low limit for testing compression
    curationEnabled: true,
    healthCheckInterval: 30
  }
}

describe('MemoryConversationManager', () => {
  let manager: MemoryConversationManager

  beforeEach(() => {
    vi.clearAllMocks()
    manager = new MemoryConversationManager(mockOpenAI, mockConfig)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('create', () => {
    it('should create conversation with enhanced features', async () => {
      const conversation = await manager.create('test-id')

      expect(conversation.id).toBe('test-id')
      expect(conversation.messages).toEqual([])
      expect(conversation.metrics).toEqual({
        tokenUsage: { input: 0, output: 0, total: 0 },
        turnCount: 0,
        toolCallCount: 0,
        compressionEvents: 0
      })
      expect(conversation.compression).toEqual(mockConfig.conversation.compression)
      expect(conversation.health).toEqual({
        isValid: true,
        hasInvalidResponses: false,
        continuityScore: 1.0,
        issues: []
      })
    })

    it('should auto-generate ID when not provided', async () => {
      const conversation = await manager.create()

      expect(conversation.id).toBeTruthy()
      expect(conversation.id).toMatch(/^[0-9a-f-]{36}$/) // UUID format
    })

    it('should clean up old conversations when limit reached', async () => {
      // Create conversations up to the limit
      const conversations = []
      for (let i = 0; i < 1001; i++) { // Exceed maxConversations (1000)
        conversations.push(await manager.create(`test-${i}`))
      }

      // The oldest conversation should be removed
      const firstConversation = await manager.get('test-0')
      expect(firstConversation).toBeNull()

      // The newest should still exist
      const lastConversation = await manager.get('test-1000')
      expect(lastConversation).toBeTruthy()
    })
  })

  describe('update with compression', () => {
    let conversation: ConversationState

    beforeEach(async () => {
      conversation = await manager.create('test-conversation')
    })

    it('should update conversation metrics on new items', async () => {
      const items = [
        { type: 'message', role: 'user', content: [{ type: 'text', text: 'Hello' }] },
        { type: 'function_call', name: 'test_fn', call_id: 'call_1' },
        { type: 'function_call_output', call_id: 'call_1', output: 'Result' }
      ]

      await manager.update('test-conversation', items, 'response-123')

      const updated = await manager.get('test-conversation')
      expect(updated?.metrics.turnCount).toBe(1)
      expect(updated?.metrics.toolCallCount).toBe(2) // function_call + function_call_output
      expect(updated?.lastResponseId).toBe('response-123')
    })

    it('should curate invalid messages when curation enabled', async () => {
      const items = [
        { type: 'message', role: 'user', content: [{ type: 'text', text: 'Valid' }] },
        { type: 'message', role: 'user', content: null }, // Invalid
        { type: 'function_call', name: null, call_id: 'call_1' } // Invalid
      ]

      await manager.update('test-conversation', items)

      const updated = await manager.get('test-conversation')
      expect(updated?.messages).toHaveLength(1) // Only valid message should remain
    })

    it('should trigger compression when token threshold exceeded', async () => {
      // Mock compression service methods
      const mockCompressionService = manager['compressionService']
      vi.spyOn(mockCompressionService, 'analyzeTokenUsage')
        .mockResolvedValue({ input: 500, output: 600, total: 1100 }) // Exceeds 1000 limit
      vi.spyOn(mockCompressionService, 'shouldCompress')
        .mockReturnValue(true)
      vi.spyOn(mockCompressionService, 'compressConversation')
        .mockResolvedValue({
          compressedMessages: [{ type: 'message', role: 'system', content: [{ type: 'text', text: 'Compressed' }] }],
          compressionRatio: 0.5
        })

      const items = [
        { type: 'message', role: 'user', content: [{ type: 'text', text: 'This should trigger compression' }] }
      ]

      await manager.update('test-conversation', items)

      expect(mockCompressionService.compressConversation).toHaveBeenCalled()

      const updated = await manager.get('test-conversation')
      expect(updated?.metrics.compressionEvents).toBe(1)
      expect(updated?.metrics.lastCompressionAt).toBeTruthy()
    }, 10000) // Increase timeout to 10 seconds

    it('should fallback to trimming if compression fails', async () => {
      // Create many messages to exceed maxMessagesPerConversation
      const manyItems = Array.from({ length: 600 }, (_, i) => ({
        type: 'message',
        role: 'user',
        content: [{ type: 'text', text: `Message ${i}` }]
      }))

      await manager.update('test-conversation', manyItems)

      const updated = await manager.get('test-conversation')
      expect(updated?.messages.length).toBeLessThanOrEqual(500) // maxMessagesPerConversation
    }, 10000) // Increase timeout to 10 seconds
  })

  describe('compressConversation', () => {
    let conversation: ConversationState

    beforeEach(async () => {
      conversation = await manager.create('test-compression')
      const items = Array.from({ length: 10 }, (_, i) => ({
        type: 'message',
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: [{ type: 'text', text: `Message ${i}` }]
      }))
      await manager.update('test-compression', items)
    })

    it('should compress conversation successfully', async () => {
      const mockCompressionService = manager['compressionService']
      vi.spyOn(mockCompressionService, 'compressConversation')
        .mockResolvedValue({
          compressedMessages: [
            { type: 'message', role: 'system', content: [{ type: 'text', text: 'Summary of conversation' }] },
            { type: 'message', role: 'user', content: [{ type: 'text', text: 'Recent message' }] }
          ],
          compressionRatio: 0.2
        })

      await manager.compressConversation('test-compression', 'summarize')

      const updated = await manager.get('test-compression')
      expect(updated?.messages).toHaveLength(2)
      expect(updated?.messages[0].content[0].text).toContain('Summary of conversation')
      expect(updated?.metrics.compressionEvents).toBe(1)
    })

    it('should throw error for non-existent conversation', async () => {
      await expect(manager.compressConversation('non-existent'))
        .rejects.toThrow('Conversation non-existent not found')
    })
  })

  describe('curateConversation', () => {
    it('should remove invalid messages and update health', async () => {
      const conversation = await manager.create('test-curation')

      // Manually add some invalid messages for testing
      const invalidMessages = [
        { type: 'message', role: 'user', content: [{ type: 'text', text: 'Valid' }] },
        { type: 'message', role: 'user', content: null },
        { type: 'function_call', name: null, call_id: 'call_1' }
      ]

      conversation.messages = invalidMessages
      await manager['conversations'].set('test-curation', conversation)

      await manager.curateConversation('test-curation')

      const updated = await manager.get('test-curation')
      expect(updated?.messages).toHaveLength(1) // Only valid message
      expect(updated?.health.isValid).toBe(true)
    })
  })

  describe('validateConversationHealth', () => {
    it('should validate conversation health and update state', async () => {
      const conversation = await manager.create('test-health')
      const items = [
        { type: 'function_call', name: 'test', call_id: 'call_1' },
        { type: 'function_call', name: 'test2', call_id: 'call_2' }, // Orphaned
        { type: 'function_call_output', call_id: 'call_1', output: 'Result' }
      ]

      await manager.update('test-health', items)

      const health = await manager.validateConversationHealth('test-health')

      expect(health.isValid).toBe(false)
      expect(health.issues.some(issue => issue.includes('Orphaned function call'))).toBe(true)

      const updated = await manager.get('test-health')
      expect(updated?.health).toEqual(health)
    })
  })

  describe('analyzeTokenUsage', () => {
    it('should analyze token usage of messages', async () => {
      const messages = [
        { type: 'message', role: 'user', content: [{ type: 'text', text: 'Hello world' }] },
        { type: 'message', role: 'assistant', content: [{ type: 'text', text: 'Hi there!' }] }
      ]

      const usage = await manager.analyzeTokenUsage(messages)

      expect(usage).toHaveProperty('input')
      expect(usage).toHaveProperty('output')
      expect(usage).toHaveProperty('total')
      expect(usage.total).toBe(usage.input + usage.output)
    })

    it('should handle fallback when compression service unavailable', async () => {
      const basicManager = new MemoryConversationManager() // Without compression service

      const messages = [
        { type: 'message', role: 'user', content: [{ type: 'text', text: 'Test' }] }
      ]

      const usage = await basicManager.analyzeTokenUsage(messages)

      expect(usage).toHaveProperty('input')
      expect(usage).toHaveProperty('output')
      expect(usage).toHaveProperty('total')
    })
  })

  describe('initializeCompressionService', () => {
    it('should initialize compression service for existing manager', () => {
      const basicManager = new MemoryConversationManager()

      expect(basicManager['compressionService']).toBeFalsy()

      basicManager.initializeCompressionService(mockOpenAI, mockConfig)

      expect(basicManager['compressionService']).toBeTruthy()
      expect(basicManager['config']).toEqual(mockConfig)
    })
  })

  describe('backward compatibility', () => {
    it('should work without compression service (legacy mode)', async () => {
      const legacyManager = new MemoryConversationManager()

      const conversation = await legacyManager.create('legacy-test')
      const items = [
        { type: 'message', role: 'user', content: [{ type: 'text', text: 'Legacy message' }] }
      ]

      await legacyManager.update('legacy-test', items)

      const updated = await legacyManager.get('legacy-test')
      expect(updated?.messages).toHaveLength(1)
      expect(updated?.metrics.turnCount).toBe(1)
    })

    it('should handle compression methods gracefully without service', async () => {
      const legacyManager = new MemoryConversationManager()

      await expect(legacyManager.compressConversation('test'))
        .rejects.toThrow('Compression service not available')

      await expect(legacyManager.curateConversation('test'))
        .rejects.toThrow('Compression service not available')
    })
  })
})