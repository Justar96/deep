// Tests for conversation compression functionality
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ConversationCompressionService } from '@deep-agent/core'
import type { DeepConfig, ConversationMetrics } from '@deep-agent/core'
import { createTestConfig } from '../../../../test-utils/test-config'

// Mock OpenAI client
const mockOpenAI = {
  chat: {
    completions: {
      create: vi.fn()
    }
  },
  responses: {
    create: vi.fn()
  }
} as any

// Mock configuration
const mockConfig: DeepConfig = createTestConfig({
  model: 'gpt-4o'
})

describe('ConversationCompressionService', () => {
  let service: ConversationCompressionService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ConversationCompressionService(mockOpenAI, mockConfig)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('analyzeTokenUsage', () => {
    it('should analyze token usage correctly', async () => {
      const messages = [
        {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'Hello world! This is a test message.' }]
        },
        {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'Hello! How can I help you today?' }]
        },
        {
          type: 'function_call',
          name: 'test_function',
          arguments: { param: 'value' },
          call_id: 'call_123'
        },
        {
          type: 'function_call_output',
          call_id: 'call_123',
          output: 'Function executed successfully'
        }
      ]

      const tokenUsage = await service.analyzeTokenUsage(messages)

      expect(tokenUsage).toHaveProperty('input')
      expect(tokenUsage).toHaveProperty('output')
      expect(tokenUsage).toHaveProperty('total')
      expect(tokenUsage.total).toBe(tokenUsage.input + tokenUsage.output)
      expect(tokenUsage.total).toBeGreaterThan(0)
    })

    it('should handle empty message array', async () => {
      const tokenUsage = await service.analyzeTokenUsage([])

      expect(tokenUsage).toEqual({
        input: 0,
        output: 0,
        total: 0
      })
    })
  })

  describe('findSplitPoint', () => {
    beforeEach(() => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: `SPLIT_INDEX: 5
REASONING: This split point preserves the most recent function call chain and important context
CONFIDENCE: 85
PRESERVED_FUNCTIONS: test_function, another_function`
          }
        }]
      })
    })

    it('should find optimal split point with AI analysis', async () => {
      const messages = Array.from({ length: 20 }, (_, i) => ({
        type: 'message',
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: [{ type: 'text', text: `Message ${i}` }]
      }))

      const splitAnalysis = await service.findSplitPoint(messages)

      expect(splitAnalysis.splitIndex).toBe(5)
      expect(splitAnalysis.reasoning).toContain('function call chain')
      expect(splitAnalysis.confidence).toBe(85)
      expect(splitAnalysis.preservedItems).toHaveLength(15) // 20 - 5
      expect(splitAnalysis.compressibleItems).toHaveLength(5)
    })

    it('should handle API errors with fallback split', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'))

      const messages = Array.from({ length: 10 }, (_, i) => ({
        type: 'message',
        role: 'user',
        content: [{ type: 'text', text: `Message ${i}` }]
      }))

      const splitAnalysis = await service.findSplitPoint(messages)

      expect(splitAnalysis.splitIndex).toBe(3) // 30% of 10
      expect(splitAnalysis.reasoning).toBe('Fallback split due to analysis error')
      expect(splitAnalysis.confidence).toBe(30)
    })

    it('should handle malformed API responses', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: 'Invalid response format'
          }
        }]
      })

      const messages = Array.from({ length: 10 }, (_, i) => ({
        type: 'message',
        role: 'user',
        content: [{ type: 'text', text: `Message ${i}` }]
      }))

      const splitAnalysis = await service.findSplitPoint(messages)

      // Should use fallback values when parsing fails
      expect(splitAnalysis.splitIndex).toBe(3)
      expect(splitAnalysis.confidence).toBe(50) // Default fallback confidence
    })
  })

  describe('compressConversation', () => {
    beforeEach(() => {
      // Mock split point analysis
      vi.spyOn(service, 'findSplitPoint').mockResolvedValue({
        splitIndex: 5,
        preservedItems: [
          { type: 'message', role: 'user', content: [{ type: 'text', text: 'Recent message' }] }
        ],
        compressibleItems: [
          { type: 'message', role: 'user', content: [{ type: 'text', text: 'Old message 1' }] },
          { type: 'message', role: 'assistant', content: [{ type: 'text', text: 'Old response 1' }] }
        ],
        reasoning: 'Test split',
        confidence: 80
      })

      // Mock summarization
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: 'This is a compressed summary of the conversation.'
          }
        }]
      })
    })

    it('should compress using summarize strategy', async () => {
      const messages = Array.from({ length: 10 }, (_, i) => ({
        type: 'message',
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: [{ type: 'text', text: `Message ${i}` }]
      }))

      const result = await service.compressConversation(messages, 'summarize')

      expect(result.compressedMessages).toHaveLength(2) // 1 summary + 1 preserved
      expect(result.compressedMessages[0].type).toBe('message')
      expect(result.compressedMessages[0].role).toBe('system')
      expect(result.compressedMessages[0].content[0].text).toContain('[COMPRESSED SUMMARY')
      expect(result.compressionRatio).toBeLessThan(1.0)
    })

    it('should handle summarization failures with truncation fallback', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('Summarization failed'))

      const messages = Array.from({ length: 10 }, (_, i) => ({
        type: 'message',
        role: 'user',
        content: [{ type: 'text', text: `Message ${i}` }]
      }))

      const result = await service.compressConversation(messages, 'summarize')

      // Should fallback to truncation
      expect(result.compressedMessages).toHaveLength(1) // Only preserved items
      expect(result.compressionRatio).toBeLessThan(1.0)
    })

    it('should handle selective compression', async () => {
      const messages = [
        { type: 'message', role: 'user', content: [{ type: 'text', text: 'User message 1' }] },
        { type: 'message', role: 'assistant', content: [{ type: 'text', text: 'Assistant response 1' }] },
        { type: 'function_call', name: 'test_fn', call_id: 'call_1', arguments: {} },
        { type: 'function_call_output', call_id: 'call_1', output: 'Result' },
        { type: 'message', role: 'user', content: [{ type: 'text', text: 'User message 2' }] },
      ]

      // Override the split analysis for this test
      vi.spyOn(service, 'findSplitPoint').mockResolvedValue({
        splitIndex: 0,
        preservedItems: messages,
        compressibleItems: messages,
        reasoning: 'Test selective',
        confidence: 80
      })

      const result = await service.compressConversation(messages, 'selective')

      // Should preserve user messages and function call chains
      expect(result.compressedMessages.some(m => m.type === 'function_call')).toBe(true)
      expect(result.compressedMessages.some(m => m.type === 'function_call_output')).toBe(true)
      expect(result.compressedMessages.some(m => m.role === 'user')).toBe(true)
    })

    it('should skip compression for short conversations', async () => {
      const messages = [
        { type: 'message', role: 'user', content: [{ type: 'text', text: 'Short conversation' }] }
      ]

      const result = await service.compressConversation(messages, 'summarize')

      expect(result.compressedMessages).toEqual(messages)
      expect(result.compressionRatio).toBe(1.0)
    })
  })

  describe('curateConversation', () => {
    it('should remove invalid messages', async () => {
      const messages = [
        { type: 'message', role: 'user', content: [{ type: 'text', text: 'Valid message' }] },
        { type: 'message', role: 'user', content: null }, // Invalid - no content
        { type: 'function_call', name: 'test', call_id: 'call_1' }, // Valid
        { type: 'function_call', name: null, call_id: 'call_2' }, // Invalid - no name
        { type: 'function_call_output', call_id: 'call_1', output: 'Result' }, // Valid
        null, // Invalid - null message
        { type: 'unknown_type', data: 'test' } // Valid - unknown types allowed
      ]

      const curated = await service.curateConversation(messages.filter(Boolean))

      expect(curated).toHaveLength(4) // Should keep 4 valid messages
      expect(curated.every(m => service['isValidMessage'](m))).toBe(true)
    })

    it('should preserve all valid messages', async () => {
      const validMessages = [
        { type: 'message', role: 'user', content: [{ type: 'text', text: 'Valid message' }] },
        { type: 'function_call', name: 'test', call_id: 'call_1' },
        { type: 'function_call_output', call_id: 'call_1', output: 'Result' },
      ]

      const curated = await service.curateConversation(validMessages)

      expect(curated).toEqual(validMessages)
    })
  })

  describe('validateConversationHealth', () => {
    it('should detect healthy conversation', async () => {
      const messages = [
        { type: 'message', role: 'user', content: [{ type: 'text', text: 'Hello' }] },
        { type: 'function_call', name: 'test', call_id: 'call_1' },
        { type: 'function_call_output', call_id: 'call_1', output: 'Result' },
        { type: 'message', role: 'assistant', content: [{ type: 'text', text: 'Done' }] }
      ]

      vi.spyOn(service, 'analyzeTokenUsage').mockResolvedValue({
        input: 100,
        output: 50,
        total: 150
      })

      const health = await service.validateConversationHealth(messages)

      expect(health.isValid).toBe(true)
      expect(health.hasInvalidResponses).toBe(false)
      expect(health.continuityScore).toBe(1.0)
      expect(health.issues).toHaveLength(0)
    })

    it('should detect orphaned function calls', async () => {
      const messages = [
        { type: 'function_call', name: 'test1', call_id: 'call_1' },
        { type: 'function_call', name: 'test2', call_id: 'call_2' }, // Orphaned
        { type: 'function_call_output', call_id: 'call_1', output: 'Result' }
      ]

      vi.spyOn(service, 'analyzeTokenUsage').mockResolvedValue({
        input: 100,
        output: 50,
        total: 150
      })

      const health = await service.validateConversationHealth(messages)

      expect(health.isValid).toBe(false)
      expect(health.continuityScore).toBeLessThan(1.0)
      expect(health.issues.some(issue => issue.includes('Orphaned function call'))).toBe(true)
    })

    it('should detect token limit exceeded', async () => {
      const messages = [
        { type: 'message', role: 'user', content: [{ type: 'text', text: 'Test' }] }
      ]

      vi.spyOn(service, 'analyzeTokenUsage').mockResolvedValue({
        input: 5000,
        output: 5000,
        total: 10000 // Exceeds mock config limit of 8000
      })

      const health = await service.validateConversationHealth(messages)

      expect(health.isValid).toBe(false)
      expect(health.issues.some(issue => issue.includes('exceeds limit'))).toBe(true)
    })
  })

  describe('shouldCompress', () => {
    it('should recommend compression when threshold exceeded', () => {
      const tokenUsage: ConversationMetrics['tokenUsage'] = {
        input: 3000,
        output: 3000,
        total: 6000 // 75% of 8000 token limit
      }

      const shouldCompress = service.shouldCompress(tokenUsage, mockConfig.conversation.compression)

      expect(shouldCompress).toBe(true)
    })

    it('should not recommend compression when below threshold', () => {
      const tokenUsage: ConversationMetrics['tokenUsage'] = {
        input: 2000,
        output: 2000,
        total: 4000 // 50% of 8000 token limit
      }

      const shouldCompress = service.shouldCompress(tokenUsage, mockConfig.conversation.compression)

      expect(shouldCompress).toBe(false)
    })

    it('should not recommend compression when disabled', () => {
      const tokenUsage: ConversationMetrics['tokenUsage'] = {
        input: 4000,
        output: 4000,
        total: 8000 // 100% of token limit
      }

      const disabledCompression = {
        ...mockConfig.conversation.compression,
        enabled: false
      }

      const shouldCompress = service.shouldCompress(tokenUsage, disabledCompression)

      expect(shouldCompress).toBe(false)
    })
  })
})