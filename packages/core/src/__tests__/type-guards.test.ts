// Type guards testing - ensuring runtime type validation
import { describe, it, expect } from 'vitest'
import {
  isUsage,
  isContentBlock,
  isMessageItem,
  isFunctionCallItem,
  isFunctionCallOutputItem,
  isReasoningItem,
  isItem,
  isResponseObject,
  isFunctionTool,
  isBuiltInTool,
  isCustomTool,
  isTool,
  assertType,
  castType,
  ValidationError,
  validateItems
} from '../types/type-guards.js'

describe('Type Guards', () => {
  describe('isUsage', () => {
    it('should validate valid usage objects', () => {
      const validUsage = {
        input_tokens: 100,
        output_tokens: 50,
        total_tokens: 150,
        input_tokens_details: { cached_tokens: 10 },
        output_tokens_details: { reasoning_tokens: 25 }
      }

      expect(isUsage(validUsage)).toBe(true)
    })

    it('should validate minimal usage objects', () => {
      const minimalUsage = {
        input_tokens: 100,
        output_tokens: 50,
        total_tokens: 150
      }

      expect(isUsage(minimalUsage)).toBe(true)
    })

    it('should reject invalid usage objects', () => {
      expect(isUsage(null)).toBe(false)
      expect(isUsage(undefined)).toBe(false)
      expect(isUsage({})).toBe(false)
      expect(isUsage({ input_tokens: 'invalid' })).toBe(false)
      expect(isUsage({ input_tokens: 100 })).toBe(false) // missing required fields
    })
  })

  describe('isContentBlock', () => {
    it('should validate input_text blocks', () => {
      const textBlock = { type: 'input_text', text: 'Hello world' }
      expect(isContentBlock(textBlock)).toBe(true)
    })

    it('should validate output_text blocks', () => {
      const textBlock = { type: 'output_text', text: 'Response text' }
      expect(isContentBlock(textBlock)).toBe(true)
    })

    it('should validate input_image blocks', () => {
      const imageBlock = {
        type: 'input_image',
        image_url: { url: 'https://example.com/image.jpg', detail: 'high' }
      }
      expect(isContentBlock(imageBlock)).toBe(true)
    })

    it('should validate input_file blocks', () => {
      const fileBlock = { type: 'input_file', file_id: 'file-123' }
      expect(isContentBlock(fileBlock)).toBe(true)
    })

    it('should reject invalid content blocks', () => {
      expect(isContentBlock(null)).toBe(false)
      expect(isContentBlock({ type: 'invalid' })).toBe(false)
      expect(isContentBlock({ type: 'input_text' })).toBe(false) // missing text
      expect(isContentBlock({ type: 'input_image' })).toBe(false) // missing image_url
    })
  })

  describe('isMessageItem', () => {
    it('should validate complete message items', () => {
      const messageItem = {
        id: 'msg-123',
        type: 'message',
        role: 'assistant',
        status: 'completed',
        content: [
          { type: 'output_text', text: 'Hello' },
          { type: 'output_text', text: ' world!' }
        ]
      }

      expect(isMessageItem(messageItem)).toBe(true)
    })

    it('should validate different roles and statuses', () => {
      const userMessage = {
        id: 'msg-456',
        type: 'message',
        role: 'user',
        status: 'in_progress',
        content: [{ type: 'input_text', text: 'User input' }]
      }

      expect(isMessageItem(userMessage)).toBe(true)
    })

    it('should reject invalid message items', () => {
      expect(isMessageItem(null)).toBe(false)
      expect(isMessageItem({ type: 'message' })).toBe(false) // missing required fields
      expect(isMessageItem({
        id: 'msg-123',
        type: 'message',
        role: 'invalid_role',
        status: 'completed',
        content: []
      })).toBe(false)
    })
  })

  describe('isFunctionCallItem', () => {
    it('should validate function call items', () => {
      const functionCall = {
        id: 'fc-123',
        type: 'function_call',
        name: 'calculate',
        arguments: '{"expression": "2 + 2"}',
        call_id: 'call-456',
        status: 'completed'
      }

      expect(isFunctionCallItem(functionCall)).toBe(true)
    })

    it('should validate without optional status', () => {
      const functionCall = {
        id: 'fc-123',
        type: 'function_call',
        name: 'calculate',
        arguments: '{"expression": "2 + 2"}',
        call_id: 'call-456'
      }

      expect(isFunctionCallItem(functionCall)).toBe(true)
    })

    it('should reject invalid function call items', () => {
      expect(isFunctionCallItem(null)).toBe(false)
      expect(isFunctionCallItem({ type: 'function_call' })).toBe(false) // missing fields
    })
  })

  describe('isFunctionCallOutputItem', () => {
    it('should validate function call output items', () => {
      const outputItem = {
        type: 'function_call_output',
        call_id: 'call-456',
        output: '{"result": 4}'
      }

      expect(isFunctionCallOutputItem(outputItem)).toBe(true)
    })

    it('should reject invalid output items', () => {
      expect(isFunctionCallOutputItem(null)).toBe(false)
      expect(isFunctionCallOutputItem({ type: 'function_call_output' })).toBe(false)
    })
  })

  describe('isReasoningItem', () => {
    it('should validate reasoning items', () => {
      const reasoningItem = {
        id: 'reasoning-123',
        type: 'reasoning',
        content: [
          { type: 'thinking', text: 'Let me think about this...' },
          { type: 'conclusion', text: 'The answer is 42' }
        ],
        summary: [{ content: 'Calculated the answer' }]
      }

      expect(isReasoningItem(reasoningItem)).toBe(true)
    })

    it('should validate without optional summary', () => {
      const reasoningItem = {
        id: 'reasoning-123',
        type: 'reasoning',
        content: [{ type: 'thinking', text: 'Internal reasoning' }]
      }

      expect(isReasoningItem(reasoningItem)).toBe(true)
    })

    it('should reject invalid reasoning items', () => {
      expect(isReasoningItem(null)).toBe(false)
      expect(isReasoningItem({ type: 'reasoning' })).toBe(false) // missing required fields
    })
  })

  describe('isItem (union type)', () => {
    it('should validate any valid item type', () => {
      const messageItem = {
        id: 'msg-123',
        type: 'message',
        role: 'assistant',
        status: 'completed',
        content: [{ type: 'output_text', text: 'Hello' }]
      }

      const functionCall = {
        id: 'fc-123',
        type: 'function_call',
        name: 'test',
        arguments: '{}',
        call_id: 'call-456'
      }

      expect(isItem(messageItem)).toBe(true)
      expect(isItem(functionCall)).toBe(true)
    })

    it('should reject non-item objects', () => {
      expect(isItem(null)).toBe(false)
      expect(isItem({})).toBe(false)
      expect(isItem({ type: 'invalid' })).toBe(false)
    })
  })

  describe('isResponseObject', () => {
    it('should validate complete response objects', () => {
      const responseObject = {
        id: 'resp-123',
        object: 'response',
        created_at: 1234567890,
        status: 'completed',
        error: null,
        incomplete_details: null,
        instructions: null,
        max_output_tokens: null,
        model: 'gpt-4o',
        output: [
          {
            id: 'msg-123',
            type: 'message',
            role: 'assistant',
            status: 'completed',
            content: [{ type: 'output_text', text: 'Hello' }]
          }
        ],
        parallel_tool_calls: true,
        previous_response_id: null,
        reasoning: { effort: 'medium' },
        store: true,
        temperature: 0.7,
        tool_choice: 'auto',
        tools: [],
        top_p: 1.0,
        truncation: 'auto',
        usage: { input_tokens: 10, output_tokens: 15, total_tokens: 25 },
        metadata: {}
      }

      expect(isResponseObject(responseObject)).toBe(true)
    })

    it('should reject invalid response objects', () => {
      expect(isResponseObject(null)).toBe(false)
      expect(isResponseObject({})).toBe(false)
      expect(isResponseObject({ id: 'resp-123' })).toBe(false) // missing required fields
    })
  })

  describe('Tool type guards', () => {
    describe('isFunctionTool', () => {
      it('should validate function tools', () => {
        const functionTool = {
          type: 'function',
          name: 'calculate',
          function: {
            name: 'calculate',
            description: 'Performs calculations',
            parameters: { type: 'object', properties: {} }
          }
        }

        expect(isFunctionTool(functionTool)).toBe(true)
      })

      it('should reject invalid function tools', () => {
        expect(isFunctionTool({ type: 'function' })).toBe(false)
      })
    })

    describe('isBuiltInTool', () => {
      it('should validate built-in tools', () => {
        expect(isBuiltInTool({ type: 'web_search' })).toBe(true)
        expect(isBuiltInTool({ type: 'file_search' })).toBe(true)
        expect(isBuiltInTool({ type: 'code_interpreter' })).toBe(true)
        expect(isBuiltInTool({ type: 'computer_use' })).toBe(true)
      })

      it('should reject invalid built-in tools', () => {
        expect(isBuiltInTool({ type: 'invalid_tool' })).toBe(false)
      })
    })

    describe('isCustomTool', () => {
      it('should validate custom tools', () => {
        const customTool = {
          type: 'custom',
          name: 'my_tool',
          description: 'A custom tool'
        }

        expect(isCustomTool(customTool)).toBe(true)
      })
    })

    describe('isTool (union type)', () => {
      it('should validate any valid tool type', () => {
        const functionTool = {
          type: 'function',
          name: 'test',
          function: {
            name: 'test',
            description: 'Test tool',
            parameters: { type: 'object' }
          }
        }

        const builtInTool = { type: 'web_search' }
        const customTool = { type: 'custom', name: 'test', description: 'Test' }

        expect(isTool(functionTool)).toBe(true)
        expect(isTool(builtInTool)).toBe(true)
        expect(isTool(customTool)).toBe(true)
      })
    })
  })

  describe('Utility functions', () => {
    describe('assertType', () => {
      it('should return value when type guard passes', () => {
        const usage = { input_tokens: 10, output_tokens: 5, total_tokens: 15 }
        const result = assertType(usage, isUsage)
        expect(result).toBe(usage)
      })

      it('should throw TypeError when type guard fails', () => {
        expect(() => assertType(null, isUsage)).toThrow(TypeError)
        expect(() => assertType(null, isUsage, 'Custom error')).toThrow('Custom error')
      })
    })

    describe('castType', () => {
      it('should return value when type guard passes', () => {
        const usage = { input_tokens: 10, output_tokens: 5, total_tokens: 15 }
        const fallback = { input_tokens: 0, output_tokens: 0, total_tokens: 0 }
        const result = castType(usage, isUsage, fallback)
        expect(result).toBe(usage)
      })

      it('should return fallback when type guard fails', () => {
        const fallback = { input_tokens: 0, output_tokens: 0, total_tokens: 0 }
        const result = castType(null, isUsage, fallback)
        expect(result).toBe(fallback)
      })
    })

    describe('validateItems', () => {
      it('should validate array of valid items', () => {
        const items = [
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
            name: 'test',
            arguments: '{}',
            call_id: 'call-1'
          }
        ]

        const result = validateItems(items)
        expect(result).toEqual(items)
      })

      it('should throw ValidationError for invalid items', () => {
        const items = [
          { invalid: 'object' },
          {
            id: 'msg-1',
            type: 'message',
            role: 'user',
            status: 'completed',
            content: [{ type: 'input_text', text: 'Hello' }]
          }
        ]

        expect(() => validateItems(items)).toThrow(ValidationError)
      })
    })

    describe('ValidationError', () => {
      it('should create proper error with field and value', () => {
        const error = new ValidationError('Test error', 'testField', { test: 'value' })
        expect(error.message).toBe('Test error')
        expect(error.field).toBe('testField')
        expect(error.value).toEqual({ test: 'value' })
        expect(error.name).toBe('ValidationError')
      })
    })
  })

  describe('Edge cases and malformed data', () => {
    it('should handle null and undefined values', () => {
      expect(isUsage(null)).toBe(false)
      expect(isUsage(undefined)).toBe(false)
      expect(isItem(null)).toBe(false)
      expect(isResponseObject(undefined)).toBe(false)
    })

    it('should handle malformed nested objects', () => {
      const malformedMessage = {
        id: 'msg-123',
        type: 'message',
        role: 'assistant',
        status: 'completed',
        content: [
          { type: 'output_text' }, // missing text
          null, // invalid content block
          { type: 'invalid_type', text: 'test' }
        ]
      }

      expect(isMessageItem(malformedMessage)).toBe(false)
    })

    it('should handle partial objects', () => {
      const partialUsage = { input_tokens: 10 } // missing required fields
      expect(isUsage(partialUsage)).toBe(false)
    })

    it('should handle wrong data types', () => {
      expect(isUsage('string')).toBe(false)
      expect(isUsage(123)).toBe(false)
      expect(isUsage([])).toBe(false)
    })
  })
})