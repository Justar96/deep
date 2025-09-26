// Integration tests for type safety across package boundaries
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DeepEngine } from '../models/deep-engine.js'
import { OpenAIResponseClient } from '../responses/response-client.js'
import { MemoryConversationManager } from '../conversations/conversation-manager.js'
import { BaseToolRegistry } from '../tools/base-tool-registry.js'
import type { IToolRegistry, IConversationManager } from '../types/core-types.js'
import type { 
  ResponseObject, 
  Item, 
  Tool, 
  DeepEvent, 
  ConversationState,
  Usage
} from '../types/index.js'
import { 
  isResponseObject, 
  isItem,
  assertType
} from '../types/index.js'

describe('Type Integration Tests', () => {
  describe('Cross-package Type Compatibility', () => {
    it('should maintain type safety between engine and client', async () => {
      const mockConfig = {
        apiKey: 'test-api-key',
        baseUrl: null,
        model: 'gpt-4o',
        useResponsesDefault: true,
        stream: false,
        store: true,
        verbosity: 'medium' as const,
        reasoningEffort: 'medium' as const,
        enableSummary: false,
        includeEncrypted: false,
        allowedTools: [],
        logPaths: false,
        conversation: {
          compression: {
            enabled: false,
            threshold: 0.7,
            strategy: 'summarize' as const,
            preserveContext: true,
            maxCompressionRatio: 0.3
          },
          maxTokens: 128000,
          curationEnabled: true,
          healthCheckInterval: 60
        },
        tools: {
          confirmationEnabled: false,
          confirmationTimeoutMs: 30000,
          autoApprovalForLowRisk: true,
          auditTrailEnabled: true,
          sandboxingEnabled: false,
          emergencyStopEnabled: true,
          maxConcurrentExecutions: 5,
          executionTimeoutMs: 60000
        }
      }
      const engine = new DeepEngine(mockConfig)

      // Verify types are exported and accessible
      expect(typeof engine.processMessage).toBe('function')
      expect(typeof engine.getConversation).toBe('function')
      expect(typeof engine.listConversations).toBe('function')
    })

    it('should validate ResponseObject type from OpenAI client', () => {
      const mockResponse: ResponseObject = {
        id: 'resp-123',
        object: 'response',
        created_at: Date.now(),
        status: 'completed',
        error: null,
        incomplete_details: null,
        instructions: null,
        max_output_tokens: null,
        model: 'gpt-4o',
        output: [{
          id: 'msg-1',
          type: 'message',
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'output_text', text: 'Hello' }]
        }],
        parallel_tool_calls: false,
        previous_response_id: null,
        reasoning: { effort: 'medium' },
        store: true,
        temperature: 1.0,
        tool_choice: 'auto',
        tools: [],
        top_p: 1.0,
        truncation: 'auto',
        usage: { input_tokens: 10, output_tokens: 15, total_tokens: 25 },
        metadata: {}
      }

      expect(isResponseObject(mockResponse)).toBe(true)
      
      // Type-safe access to properties
      const validResponse = assertType(mockResponse, isResponseObject)
      expect(validResponse.usage.total_tokens).toBe(25)
      expect(validResponse.output[0]?.type).toBe('message')
    })

    it('should validate Item array type consistency', () => {
      const items: Item[] = [
        {
          id: 'msg-1',
          type: 'message',
          role: 'user',
          status: 'completed',
          content: [{ type: 'input_text', text: 'Hello' }]
        },
        {
          id: 'fc-1',
          type: 'function_call',
          name: 'test_function',
          arguments: '{"param": "value"}',
          call_id: 'call-1'
        },
        {
          type: 'function_call_output',
          call_id: 'call-1',
          output: 'Function result'
        }
      ]

      items.forEach(item => {
        expect(isItem(item)).toBe(true)
      })

      // Type-safe operations on union types
      items.forEach(item => {
        expect(item.type).toMatch(/^(message|function_call|function_call_output|reasoning)$/)
        
        if (item.type === 'message') {
          expect(item.id).toBeDefined()
          expect(item.role).toMatch(/^(user|assistant|system)$/)
          expect(Array.isArray(item.content)).toBe(true)
        }
        
        if (item.type === 'function_call') {
          expect(item.name).toBeDefined()
          expect(item.call_id).toBeDefined()
          expect(typeof item.arguments).toBe('string')
        }
      })
    })

    it('should validate Tool type compatibility', () => {
      const functionTool: Tool = {
        type: 'function',
        name: 'test_tool',
        function: {
          name: 'test_tool',
          description: 'A test function tool',
          parameters: {
            type: 'object',
            properties: {
              input: { type: 'string' }
            },
            required: ['input']
          }
        }
      }

      const builtInTool: Tool = {
        type: 'web_search'
      }

      const customTool: Tool = {
        type: 'custom',
        name: 'custom_tool',
        description: 'A custom tool implementation'
      }

      const tools: Tool[] = [functionTool, builtInTool, customTool]
      
      tools.forEach(tool => {
        expect(['function', 'web_search', 'file_search', 'code_interpreter', 'computer_use', 'custom']).toContain(tool.type)
      })
    })
  })

  describe('Type Guard Integration', () => {
    it('should safely handle unknown API responses', () => {
      const unknownResponse = {
        id: 'resp-unknown',
        object: 'response',
        // Missing some required fields intentionally
        status: 'completed'
      }

      const malformedResponse = {
        id: 'resp-malformed',
        object: 'response',
        created_at: 'invalid-timestamp', // Should be number
        status: 'completed',
        model: 'gpt-4o',
        output: 'invalid-output', // Should be array
        usage: { invalid: 'usage' } // Wrong structure
      }

      expect(isResponseObject(unknownResponse)).toBe(false)
      expect(isResponseObject(malformedResponse)).toBe(false)
    })

    it('should handle edge cases in conversation items', () => {
      const edgeCases = [
        null,
        undefined,
        {},
        { type: 'unknown' },
        { type: 'message' }, // Missing required fields
        { type: 'message', id: 'msg-1', role: 'invalid_role' },
        { type: 'function_call', name: 'test' }, // Missing required fields
        { type: 'function_call_output' }, // Missing required fields
      ]

      edgeCases.forEach(edgeCase => {
        expect(isItem(edgeCase)).toBe(false)
      })
    })

    it('should provide type-safe error handling', () => {
      const tryValidateResponse = (data: unknown): ResponseObject | null => {
        try {
          return assertType(data, isResponseObject, 'Invalid response format')
        } catch {
          return null
        }
      }

      const validData = {
        id: 'resp-123',
        object: 'response',
        created_at: Date.now(),
        status: 'completed',
        error: null,
        incomplete_details: null,
        instructions: null,
        max_output_tokens: null,
        model: 'gpt-4o',
        output: [],
        parallel_tool_calls: false,
        previous_response_id: null,
        reasoning: {},
        store: false,
        temperature: 1.0,
        tool_choice: 'auto',
        tools: [],
        top_p: 1.0,
        truncation: 'auto',
        usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
        metadata: {}
      }

      const result = tryValidateResponse(validData)
      expect(result).not.toBeNull()
      expect(result?.id).toBe('resp-123')

      const invalidResult = tryValidateResponse({ invalid: 'data' })
      expect(invalidResult).toBeNull()
    })
  })

  describe('Event System Type Safety', () => {
    it('should ensure DeepEvent type consistency', () => {
      const events: DeepEvent[] = [
        { type: 'turn_start', data: { conversationId: 'conv-1', input: 'Hello' } },
        { type: 'response_start', data: { responseId: 'resp-1' } },
        { type: 'content_delta', data: { text: 'Hello world' } },
        { type: 'tool_call', data: { name: 'test_tool', input: '{}', callId: 'call-1' } },
        { type: 'tool_result', data: { callId: 'call-1', output: 'result' } },
        { type: 'turn_complete', data: { 
          usage: { input_tokens: 10, output_tokens: 15, total_tokens: 25 }, 
          responseId: 'resp-1' 
        }},
        { type: 'error', data: { error: 'Test error', code: 'TEST_ERROR' } }
      ]

      // Type-safe event processing
      events.forEach(event => {
        expect(event.type).toBeDefined()
        expect(event.data).toBeDefined()

        switch (event.type) {
          case 'turn_start':
            expect(typeof event.data.conversationId).toBe('string')
            expect(typeof event.data.input).toBe('string')
            break
          case 'turn_complete':
            expect(typeof event.data.usage).toBe('object')
            expect(typeof event.data.responseId).toBe('string')
            break
          case 'content_delta':
            expect(typeof event.data.text).toBe('string')
            break
          // TypeScript ensures all cases are handled
        }
      })
    })

    it('should maintain type safety in conversation state', () => {
      const conversationState: ConversationState = {
        id: 'conv-123',
        messages: [
          {
            id: 'msg-1',
            type: 'message',
            role: 'user',
            status: 'completed',
            content: [{ type: 'input_text', text: 'Hello' }]
          },
          {
            id: 'msg-2',
            type: 'message',
            role: 'assistant',
            status: 'completed',
            content: [{ type: 'output_text', text: 'Hi there!' }]
          }
        ],
        lastResponseId: 'resp-123',
        metadata: { source: 'test' },
        createdAt: new Date(),
        updatedAt: new Date(),
        metrics: {
          tokenUsage: { input: 10, output: 15, total: 25 },
          turnCount: 2,
          toolCallCount: 0,
          compressionEvents: 0
        },
        compression: {
          enabled: false,
          threshold: 0.7,
          strategy: 'summarize',
          preserveContext: true,
          maxCompressionRatio: 0.3
        },
        health: {
          isValid: true,
          hasInvalidResponses: false,
          continuityScore: 1.0,
          issues: []
        }
      }

      expect(conversationState.messages.length).toBe(2)
      expect(conversationState.messages.every(isItem)).toBe(true)
      expect(conversationState.health.isValid).toBe(true)
    })
  })

  describe('Performance and Memory Impact', () => {
    it('should not significantly impact performance with type guards', () => {
      const largeDataSet: unknown[] = Array(1000).fill(null).map((_, i) => ({
        id: `msg-${i}`,
        type: 'message',
        role: 'user',
        status: 'completed',
        content: [{ type: 'input_text', text: `Message ${i}` }]
      }))

      const startTime = performance.now()
      const validItems = largeDataSet.filter(isItem)
      const endTime = performance.now()

      expect(validItems).toHaveLength(1000)
      expect(endTime - startTime).toBeLessThan(100) // Should be fast
    })

    it('should handle deeply nested validation efficiently', () => {
      const complexResponse: ResponseObject = {
        id: 'resp-complex',
        object: 'response',
        created_at: Date.now(),
        status: 'completed',
        error: null,
        incomplete_details: null,
        instructions: null,
        max_output_tokens: null,
        model: 'gpt-4o',
        output: Array(50).fill(null).map((_, i) => ({
          id: `msg-${i}`,
          type: 'message' as const,
          role: 'assistant' as const,
          status: 'completed' as const,
          content: Array(10).fill(null).map((_, j) => ({
            type: 'output_text' as const,
            text: `Content ${i}-${j}`
          }))
        })),
        parallel_tool_calls: false,
        previous_response_id: null,
        reasoning: { effort: 'medium' },
        store: true,
        temperature: 1.0,
        tool_choice: 'auto',
        tools: [],
        top_p: 1.0,
        truncation: 'auto',
        usage: { input_tokens: 100, output_tokens: 500, total_tokens: 600 },
        metadata: {}
      }

      const startTime = performance.now()
      const isValid = isResponseObject(complexResponse)
      const endTime = performance.now()

      expect(isValid).toBe(true)
      expect(endTime - startTime).toBeLessThan(50) // Should validate quickly
    })
  })
})