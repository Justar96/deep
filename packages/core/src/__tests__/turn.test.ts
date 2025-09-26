// Comprehensive tests for Turn class
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TurnContext, DeepEvent, ConversationState } from '@deep-agent/core'
import { createTestConversationState, createTestEvent } from '../../../../test-utils/test-config'

// Import Turn class
const { Turn } = await import('@deep-agent/core')

// Mock objects
const createMockConversation = (): ConversationState => createTestConversationState({
  id: 'test-conversation',
  messages: [
    {
      type: 'message',
      role: 'user',
      content: [{ type: 'input_text', text: 'Previous message' }]
    },
    {
      type: 'message',
      role: 'assistant',
      content: [{ type: 'output_text', text: 'Previous response' }]
    }
  ],
  lastResponseId: 'resp-previous',
  metrics: {
    tokenUsage: { input: 50, output: 30, total: 80 },
    turnCount: 1,
    toolCallCount: 0,
    compressionEvents: 0
  },
  compressionSummary: null,
  health: {
    isValid: true,
    hasInvalidResponses: false,
    continuityScore: 1.0,
    issues: []
  }
})

const createMockContext = (): TurnContext => ({
  conversationId: 'test-conversation',
  userInput: 'Hello, how are you?',
  tools: [
    {
      type: 'function',
      function: {
        name: 'test_tool',
        description: 'Test tool'
      }
    }
  ],
  maxOutputTokens: 1000,
  previousResponseId: 'resp-previous'
})

describe('Turn', () => {
  let turn: InstanceType<typeof Turn>
  let mockResponseClient: any
  let mockToolRegistry: any
  let mockConversationManager: any
  let mockContext: TurnContext

  beforeEach(() => {
    vi.clearAllMocks()

    mockContext = createMockContext()

    mockResponseClient = {
      create: vi.fn(),
      followup: vi.fn()
    }

    mockToolRegistry = {
      getTools: vi.fn().mockReturnValue([
        { type: 'function', function: { name: 'test_tool' } }
      ]),
      executeToolCall: vi.fn()
    }

    mockConversationManager = {
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    }

    turn = new Turn(mockContext, mockResponseClient, mockToolRegistry, mockConversationManager)
  })

  describe('constructor', () => {
    it('should initialize with context and dependencies', () => {
      expect(turn).toBeInstanceOf(Turn)
      expect((turn as any).context).toBe(mockContext)
      expect((turn as any).responseClient).toBe(mockResponseClient)
      expect((turn as any).toolRegistry).toBe(mockToolRegistry)
      expect((turn as any).conversationManager).toBe(mockConversationManager)
    })

    it('should extend EventEmitter', () => {
      const EventEmitter = require('eventemitter3').EventEmitter
      expect(turn).toBeInstanceOf(EventEmitter)
    })
  })

  describe('run - basic flow', () => {
    beforeEach(() => {
      mockConversationManager.get.mockResolvedValue(createMockConversation())
      mockResponseClient.create.mockResolvedValue({
        id: 'resp-123',
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: 'Hello! I am doing well, thank you.' }]
          }
        ],
        usage: { input_tokens: 10, output_tokens: 15, total_tokens: 25 }
      })
    })

    it('should yield complete turn sequence', async () => {
      const events: DeepEvent[] = []

      for await (const event of turn.run()) {
        events.push(event)
      }

      expect(events).toHaveLength(4)
      expect(events[0].type).toBe('turn_start')
      expect(events[1].type).toBe('response_start')
      expect(events[2].type).toBe('content_delta')
      expect(events[3].type).toBe('turn_complete')
    })

    it('should yield turn_start with conversation ID and input', async () => {
      const events: DeepEvent[] = []

      for await (const event of turn.run()) {
        if (event.type === 'turn_start') {
          expect(event.data).toEqual({
            conversationId: 'test-conversation',
            input: 'Hello, how are you?'
          })
        }
        events.push(event)
        if (events.length >= 1) break // Just test the first event
      }
    })

    it('should yield response_start with response ID', async () => {
      const events: DeepEvent[] = []

      for await (const event of turn.run()) {
        if (event.type === 'response_start') {
          expect(event.data).toEqual({
            responseId: 'resp-123'
          })
        }
        events.push(event)
        if (events.length >= 2) break // Test first two events
      }
    })

    it('should yield turn_complete with usage and response ID', async () => {
      const events: DeepEvent[] = []

      for await (const event of turn.run()) {
        events.push(event)
      }

      const turnComplete = events.find(e => e.type === 'turn_complete')
      expect(turnComplete?.data).toEqual({
        usage: { input_tokens: 10, output_tokens: 15, total_tokens: 25 },
        responseId: 'resp-123'
      })
    })
  })

  describe('run - conversation management', () => {
    it('should get existing conversation', async () => {
      mockConversationManager.get.mockResolvedValue(createMockConversation())
      mockResponseClient.create.mockResolvedValue({
        id: 'resp-123',
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'Response' }] }]
      })

      const events: DeepEvent[] = []
      for await (const event of turn.run()) {
        events.push(event)
      }

      expect(mockConversationManager.get).toHaveBeenCalledWith('test-conversation')
    })

    it('should create new conversation if not found', async () => {
      mockConversationManager.get.mockResolvedValue(null)
      mockConversationManager.create.mockResolvedValue(createMockConversation())
      mockResponseClient.create.mockResolvedValue({
        id: 'resp-123',
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'Response' }] }]
      })

      const events: DeepEvent[] = []
      for await (const event of turn.run()) {
        events.push(event)
      }

      expect(mockConversationManager.create).toHaveBeenCalledWith('test-conversation')
    })

    it('should build input with conversation history', async () => {
      const conversation = createMockConversation()
      mockConversationManager.get.mockResolvedValue(conversation)
      mockResponseClient.create.mockResolvedValue({
        id: 'resp-123',
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'Response' }] }]
      })

      const events: DeepEvent[] = []
      for await (const event of turn.run()) {
        events.push(event)
      }

      const expectedInput = [
        ...conversation.messages,
        {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'Hello, how are you?' }]
        }
      ]

      expect(mockResponseClient.create).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expectedInput
        })
      )
    })

    it('should include previous response ID', async () => {
      mockConversationManager.get.mockResolvedValue(createMockConversation())
      mockResponseClient.create.mockResolvedValue({
        id: 'resp-123',
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'Response' }] }]
      })

      const events: DeepEvent[] = []
      for await (const event of turn.run()) {
        events.push(event)
      }

      expect(mockResponseClient.create).toHaveBeenCalledWith(
        expect.objectContaining({
          previous_response_id: 'resp-previous'
        })
      )
    })

    it('should update conversation with new items', async () => {
      const conversation = createMockConversation()
      mockConversationManager.get.mockResolvedValue(conversation)
      mockResponseClient.create.mockResolvedValue({
        id: 'resp-123',
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'Response' }] }]
      })

      const events: DeepEvent[] = []
      for await (const event of turn.run()) {
        events.push(event)
      }

      expect(mockConversationManager.update).toHaveBeenCalledWith(
        'test-conversation',
        expect.arrayContaining([
          expect.objectContaining({
            type: 'message',
            role: 'user'
          })
        ]),
        'resp-123'
      )
    })
  })

  describe('processResponse', () => {
    it('should process output_text content', async () => {
      mockConversationManager.get.mockResolvedValue(createMockConversation())
      mockResponseClient.create.mockResolvedValue({
        id: 'resp-123',
        output: [
          {
            type: 'message',
            content: [
              { type: 'output_text', text: 'Hello!' },
              { type: 'output_text', text: ' How are you?' }
            ]
          }
        ]
      })

      const events: DeepEvent[] = []
      for await (const event of turn.run()) {
        if (event.type === 'content_delta') {
          events.push(event)
        }
      }

      expect(events).toHaveLength(2)
      expect(events[0].data).toEqual({ text: 'Hello!' })
      expect(events[1].data).toEqual({ text: ' How are you?' })
    })

    it('should process text content (legacy format)', async () => {
      mockConversationManager.get.mockResolvedValue(createMockConversation())
      mockResponseClient.create.mockResolvedValue({
        id: 'resp-123',
        output: [
          {
            type: 'message',
            content: [{ type: 'text', text: 'Legacy format text' }]
          }
        ]
      })

      const events: DeepEvent[] = []
      for await (const event of turn.run()) {
        if (event.type === 'content_delta') {
          events.push(event)
        }
      }

      expect(events).toHaveLength(1)
      expect(events[0].data).toEqual({ text: 'Legacy format text' })
    })

    it('should process function_call items', async () => {
      mockConversationManager.get.mockResolvedValue(createMockConversation())
      mockResponseClient.create.mockResolvedValue({
        id: 'resp-123',
        output: [
          {
            type: 'function_call',
            name: 'test_tool',
            arguments: '{"param": "value"}',
            call_id: 'call-123'
          }
        ]
      })

      mockToolRegistry.executeToolCall.mockResolvedValue('Tool result')

      const events: DeepEvent[] = []
      for await (const event of turn.run()) {
        if (event.type === 'tool_call') {
          events.push(event)
        }
      }

      expect(events).toHaveLength(1)
      expect(events[0].data).toEqual({
        name: 'test_tool',
        input: '{"param": "value"}',
        callId: 'call-123'
      })
    })

    it('should handle function_call with input field', async () => {
      mockConversationManager.get.mockResolvedValue(createMockConversation())
      mockResponseClient.create.mockResolvedValue({
        id: 'resp-123',
        output: [
          {
            type: 'function_call',
            name: 'test_tool',
            input: '{"param": "value"}',
            call_id: 'call-123'
          }
        ]
      })

      mockToolRegistry.executeToolCall.mockResolvedValue('Tool result')

      const events: DeepEvent[] = []
      for await (const event of turn.run()) {
        if (event.type === 'tool_call') {
          events.push(event)
        }
      }

      expect(events[0].data.input).toBe('{"param": "value"}')
    })

    it('should process reasoning items with summary', async () => {
      mockConversationManager.get.mockResolvedValue(createMockConversation())
      mockResponseClient.create.mockResolvedValue({
        id: 'resp-123',
        output: [
          {
            type: 'reasoning',
            summary: [
              { content: 'First part of reasoning' },
              { content: 'Second part of reasoning' }
            ]
          }
        ]
      })

      const events: DeepEvent[] = []
      for await (const event of turn.run()) {
        if (event.type === 'reasoning_summary') {
          events.push(event)
        }
      }

      expect(events).toHaveLength(1)
      expect(events[0].data).toEqual({
        summary: 'First part of reasoning Second part of reasoning'
      })
    })

    it('should skip reasoning items without summary', async () => {
      mockConversationManager.get.mockResolvedValue(createMockConversation())
      mockResponseClient.create.mockResolvedValue({
        id: 'resp-123',
        output: [
          {
            type: 'reasoning',
            encrypted_content: 'encrypted-data'
          }
        ]
      })

      const events: DeepEvent[] = []
      for await (const event of turn.run()) {
        if (event.type === 'reasoning_summary') {
          events.push(event)
        }
      }

      expect(events).toHaveLength(0)
    })
  })

  describe('tool execution', () => {
    beforeEach(() => {
      mockConversationManager.get.mockResolvedValue(createMockConversation())
    })

    it('should execute tool calls and continue conversation', async () => {
      // First response with tool call
      mockResponseClient.create.mockResolvedValueOnce({
        id: 'resp-tool',
        output: [
          {
            type: 'function_call',
            name: 'test_tool',
            arguments: '{"param": "value"}',
            call_id: 'call-123'
          }
        ]
      })

      // Follow-up response after tool execution
      mockResponseClient.followup.mockResolvedValue({
        id: 'resp-final',
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: 'Tool executed successfully' }]
          }
        ],
        usage: { input_tokens: 20, output_tokens: 10, total_tokens: 30 }
      })

      mockToolRegistry.executeToolCall.mockResolvedValue('Tool result')

      const events: DeepEvent[] = []
      for await (const event of turn.run()) {
        events.push(event)
      }

      expect(mockToolRegistry.executeToolCall).toHaveBeenCalledWith(
        'test_tool',
        '{"param": "value"}',
        'call-123'
      )

      expect(mockResponseClient.followup).toHaveBeenCalledWith({
        input: expect.arrayContaining([
          expect.objectContaining({
            type: 'function_call_output',
            call_id: 'call-123',
            output: 'Tool result'
          })
        ]),
        previousResponseId: 'resp-tool',
        tools: mockContext.tools,
        maxOutputTokens: 1000
      })
    })

    it('should handle tool execution errors', async () => {
      mockResponseClient.create.mockResolvedValueOnce({
        id: 'resp-tool',
        output: [
          {
            type: 'function_call',
            name: 'failing_tool',
            arguments: '{}',
            call_id: 'call-error'
          }
        ]
      })

      mockResponseClient.followup.mockResolvedValue({
        id: 'resp-final',
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: 'Tool failed but continuing' }]
          }
        ],
        usage: { input_tokens: 20, output_tokens: 10, total_tokens: 30 }
      })

      const toolError = new Error('Tool execution failed')
      mockToolRegistry.executeToolCall.mockRejectedValue(toolError)

      // Listen for tool_result events
      const toolResultEvents: DeepEvent[] = []
      turn.on('event', (event) => {
        if (event.type === 'tool_result') {
          toolResultEvents.push(event)
        }
      })

      const events: DeepEvent[] = []
      for await (const event of turn.run()) {
        events.push(event)
      }

      expect(toolResultEvents).toHaveLength(1)
      expect(toolResultEvents[0].data).toEqual({
        callId: 'call-error',
        output: 'Error: Tool execution failed'
      })

      expect(mockResponseClient.followup).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.arrayContaining([
            expect.objectContaining({
              type: 'function_call_output',
              call_id: 'call-error',
              output: 'Error: Tool execution failed'
            })
          ])
        })
      )
    })

    it('should handle non-Error tool exceptions', async () => {
      mockResponseClient.create.mockResolvedValueOnce({
        id: 'resp-tool',
        output: [
          {
            type: 'function_call',
            name: 'failing_tool',
            arguments: '{}',
            call_id: 'call-string-error'
          }
        ]
      })

      mockResponseClient.followup.mockResolvedValue({
        id: 'resp-final',
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'Done' }] }],
        usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 }
      })

      mockToolRegistry.executeToolCall.mockRejectedValue('String error')

      const toolResultEvents: DeepEvent[] = []
      turn.on('event', (event) => {
        if (event.type === 'tool_result') {
          toolResultEvents.push(event)
        }
      })

      const events: DeepEvent[] = []
      for await (const event of turn.run()) {
        events.push(event)
      }

      expect(toolResultEvents[0].data.output).toBe('Error: Tool execution failed')
    })

    it('should emit tool_result events', async () => {
      mockResponseClient.create.mockResolvedValueOnce({
        id: 'resp-tool',
        output: [
          {
            type: 'function_call',
            name: 'test_tool',
            arguments: '{}',
            call_id: 'call-emit'
          }
        ]
      })

      mockResponseClient.followup.mockResolvedValue({
        id: 'resp-final',
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'Done' }] }],
        usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 }
      })

      mockToolRegistry.executeToolCall.mockResolvedValue('Emitted result')

      const emittedEvents: DeepEvent[] = []
      turn.on('event', (event) => {
        emittedEvents.push(event)
      })

      const events: DeepEvent[] = []
      for await (const event of turn.run()) {
        events.push(event)
      }

      expect(emittedEvents).toHaveLength(1)
      expect(emittedEvents[0]).toEqual({
        type: 'tool_result',
        data: {
          callId: 'call-emit',
          output: 'Emitted result'
        }
      })
    })

    it('should handle multiple tool calls in one response', async () => {
      mockResponseClient.create.mockResolvedValueOnce({
        id: 'resp-multi-tool',
        output: [
          {
            type: 'function_call',
            name: 'tool_1',
            arguments: '{"a": 1}',
            call_id: 'call-1'
          },
          {
            type: 'function_call',
            name: 'tool_2',
            arguments: '{"b": 2}',
            call_id: 'call-2'
          }
        ]
      })

      mockResponseClient.followup.mockResolvedValue({
        id: 'resp-final',
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'All tools done' }] }],
        usage: { input_tokens: 30, output_tokens: 15, total_tokens: 45 }
      })

      mockToolRegistry.executeToolCall
        .mockResolvedValueOnce('Result 1')
        .mockResolvedValueOnce('Result 2')

      const events: DeepEvent[] = []
      for await (const event of turn.run()) {
        events.push(event)
      }

      expect(mockToolRegistry.executeToolCall).toHaveBeenCalledTimes(2)
      expect(mockToolRegistry.executeToolCall).toHaveBeenNthCalledWith(1, 'tool_1', '{"a": 1}', 'call-1')
      expect(mockToolRegistry.executeToolCall).toHaveBeenNthCalledWith(2, 'tool_2', '{"b": 2}', 'call-2')
    })
  })

  describe('error handling', () => {
    it('should yield error event on exception', async () => {
      mockConversationManager.get.mockRejectedValue(new Error('Database error'))

      const events: DeepEvent[] = []
      for await (const event of turn.run()) {
        events.push(event)
      }

      const errorEvent = events.find(e => e.type === 'error')
      expect(errorEvent).toBeTruthy()
      expect(errorEvent?.data).toEqual({
        error: 'Database error'
      })
    })

    it('should handle non-Error exceptions', async () => {
      mockConversationManager.get.mockRejectedValue('String error')

      const events: DeepEvent[] = []
      for await (const event of turn.run()) {
        events.push(event)
      }

      const errorEvent = events.find(e => e.type === 'error')
      expect(errorEvent?.data).toEqual({
        error: 'Unknown error'
      })
    })

    it('should include error code if available', async () => {
      const errorWithCode = new Error('API Error')
      ;(errorWithCode as any).code = 'RATE_LIMIT_EXCEEDED'
      mockConversationManager.get.mockRejectedValue(errorWithCode)

      const events: DeepEvent[] = []
      for await (const event of turn.run()) {
        events.push(event)
      }

      const errorEvent = events.find(e => e.type === 'error')
      expect(errorEvent?.data).toEqual({
        error: 'API Error',
        code: 'RATE_LIMIT_EXCEEDED'
      })
    })
  })

  describe('request parameters', () => {
    beforeEach(() => {
      mockConversationManager.get.mockResolvedValue(createMockConversation())
      mockResponseClient.create.mockResolvedValue({
        id: 'resp-123',
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'Response' }] }]
      })
    })

    it('should use context tools if provided', async () => {
      const events: DeepEvent[] = []
      for await (const event of turn.run()) {
        events.push(event)
      }

      expect(mockResponseClient.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: mockContext.tools
        })
      )
    })

    it('should fallback to registry tools if no context tools', async () => {
      const contextWithoutTools = { ...mockContext, tools: undefined }
      const turnWithoutTools = new Turn(
        contextWithoutTools,
        mockResponseClient,
        mockToolRegistry,
        mockConversationManager
      )

      const events: DeepEvent[] = []
      for await (const event of turnWithoutTools.run()) {
        events.push(event)
      }

      expect(mockToolRegistry.getTools).toHaveBeenCalledWith(true)
      expect(mockResponseClient.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: [{ type: 'function', function: { name: 'test_tool' } }]
        })
      )
    })

    it('should include maxOutputTokens if provided', async () => {
      const events: DeepEvent[] = []
      for await (const event of turn.run()) {
        events.push(event)
      }

      expect(mockResponseClient.create).toHaveBeenCalledWith(
        expect.objectContaining({
          max_output_tokens: 1000
        })
      )
    })

    it('should use conversation lastResponseId if no context previousResponseId', async () => {
      const contextWithoutPrevious = { ...mockContext, previousResponseId: undefined }
      const turnWithoutPrevious = new Turn(
        contextWithoutPrevious,
        mockResponseClient,
        mockToolRegistry,
        mockConversationManager
      )

      const events: DeepEvent[] = []
      for await (const event of turnWithoutPrevious.run()) {
        events.push(event)
      }

      expect(mockResponseClient.create).toHaveBeenCalledWith(
        expect.objectContaining({
          previous_response_id: 'resp-previous' // from mock conversation
        })
      )
    })
  })

  describe('hasToolCalls', () => {
    it('should detect function calls in response', () => {
      const responseWithTools = {
        output: [
          { type: 'message', content: [{ type: 'output_text', text: 'Calling tool' }] },
          { type: 'function_call', name: 'test_tool', call_id: 'call-1' }
        ]
      }

      const hasCalls = (turn as any).hasToolCalls(responseWithTools)
      expect(hasCalls).toBe(true)
    })

    it('should return false when no function calls', () => {
      const responseWithoutTools = {
        output: [
          { type: 'message', content: [{ type: 'output_text', text: 'No tools here' }] }
        ]
      }

      const hasCalls = (turn as any).hasToolCalls(responseWithoutTools)
      expect(hasCalls).toBe(false)
    })
  })
})