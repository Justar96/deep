// Comprehensive tests for OpenAIResponseClient
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { DeepConfig } from '@deep-agent/core'
import { createTestConfig } from '../../../../test-utils/test-config'

// Mock OpenAI client before importing ResponseClient
const mockOpenAIClient = {
  responses: {
    create: vi.fn()
  }
}

vi.mock('openai', () => ({
  OpenAI: vi.fn().mockImplementation(() => mockOpenAIClient)
}))

// Import after mocking
const { OpenAIResponseClient } = await import('@deep-agent/core')

// Mock configuration for testing
const mockConfig: DeepConfig = createTestConfig({
  apiKey: 'test-api-key',
  model: 'gpt-5'
})

describe('OpenAIResponseClient', () => {
  let client: InstanceType<typeof OpenAIResponseClient>
  let consoleSpy: any

  beforeEach(() => {
    vi.clearAllMocks()
    client = new OpenAIResponseClient(mockOpenAIClient as any, mockConfig)

    // Spy on console.log for testing log paths
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with OpenAI client and config', () => {
      expect(client).toBeInstanceOf(OpenAIResponseClient)
      // Test private properties through behavior
      expect((client as any).client).toBe(mockOpenAIClient)
      expect((client as any).config).toBe(mockConfig)
    })
  })

  describe('create', () => {
    const mockResponse = {
      id: 'resp-123',
      output: { type: 'text', text: 'Hello world' },
      usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 }
    }

    beforeEach(() => {
      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse)
    })

    it('should create response with enhanced parameters', async () => {
      const params = {
        input: 'Hello',
        max_output_tokens: 100
      }

      const result = await client.create(params)

      expect(mockOpenAIClient.responses.create).toHaveBeenCalledWith({
        ...params,
        model: 'gpt-5',
        store: true,
        text: { verbosity: 'medium' },
        reasoning: { effort: 'medium' }
      })
      expect(result).toBe(mockResponse)
    })

    it('should use provided model instead of config default', async () => {
      const params = {
        input: 'Hello',
        model: 'gpt-4o'
      }

      await client.create(params)

      expect(mockOpenAIClient.responses.create).toHaveBeenCalledWith({
        ...params,
        model: 'gpt-4o',
        store: true,
        // No GPT-5 steering params for non-GPT-5 models
      })
    })

    it('should log parameters and response when logPaths enabled', async () => {
      const configWithLogging = { ...mockConfig, logPaths: true }
      const clientWithLogging = new OpenAIResponseClient(mockOpenAIClient as any, configWithLogging)

      const params = { input: 'Hello' }

      await clientWithLogging.create(params)

      expect(consoleSpy).toHaveBeenCalledWith(
        '[ResponseClient] Parameters:',
        expect.stringContaining('gpt-5')
      )
      expect(consoleSpy).toHaveBeenCalledWith('[ResponseClient] Response ID:', 'resp-123')
      expect(consoleSpy).toHaveBeenCalledWith('[ResponseClient] Usage:', mockResponse.usage)
    })

    it('should add summary when enableSummary is true', async () => {
      const configWithSummary = { ...mockConfig, enableSummary: true }
      const clientWithSummary = new OpenAIResponseClient(mockOpenAIClient as any, configWithSummary)

      await clientWithSummary.create({ input: 'Hello' })

      expect(mockOpenAIClient.responses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          reasoning: { effort: 'medium', summary: 'auto' }
        })
      )
    })

    it('should add encrypted reasoning when includeEncrypted is true', async () => {
      const configWithEncrypted = { ...mockConfig, includeEncrypted: true }
      const clientWithEncrypted = new OpenAIResponseClient(mockOpenAIClient as any, configWithEncrypted)

      await clientWithEncrypted.create({ input: 'Hello' })

      expect(mockOpenAIClient.responses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          include: ['reasoning.encrypted_content'],
          store: false // Should be disabled for encrypted content
        })
      )
    })

    it('should preserve store=true when explicitly set with encrypted reasoning', async () => {
      // Mock environment variable being explicitly set
      const originalEnv = process.env.OPENAI_RESP_STORE
      process.env.OPENAI_RESP_STORE = 'true'

      const configWithEncrypted = { ...mockConfig, includeEncrypted: true, store: true }
      const clientWithEncrypted = new OpenAIResponseClient(mockOpenAIClient as any, configWithEncrypted)

      await clientWithEncrypted.create({ input: 'Hello' })

      expect(mockOpenAIClient.responses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          store: true // Should preserve explicit setting
        })
      )

      // Restore environment
      if (originalEnv !== undefined) {
        process.env.OPENAI_RESP_STORE = originalEnv
      } else {
        delete process.env.OPENAI_RESP_STORE
      }
    })

    it('should preserve existing text and reasoning params', async () => {
      const params = {
        input: 'Hello',
        text: { verbosity: 'high' },
        reasoning: { effort: 'low', custom: 'value' }
      }

      await client.create(params)

      expect(mockOpenAIClient.responses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          text: { verbosity: 'high' }, // Should keep provided value
          reasoning: { effort: 'low', custom: 'value' } // Should keep existing properties
        })
      )
    })

    it('should handle API errors with enhanced error message', async () => {
      const apiError = new Error('Invalid API key')
      mockOpenAIClient.responses.create.mockRejectedValue(apiError)

      await expect(client.create({ input: 'Hello' })).rejects.toThrow(
        'OpenAI Responses API error: Invalid API key'
      )
    })

    it('should re-throw non-Error objects', async () => {
      const stringError = 'String error'
      mockOpenAIClient.responses.create.mockRejectedValue(stringError)

      await expect(client.create({ input: 'Hello' })).rejects.toBe(stringError)
    })
  })

  describe('stream', () => {
    it('should stream responses when stream is supported', async () => {
      const mockStreamEvents = [
        { type: 'response.content.text.delta', text: 'Hello' },
        { type: 'response.content.text.delta', text: ' world' },
        { type: 'response.done' }
      ]

      // Mock async iterable
      const mockAsyncIterable = {
        [Symbol.asyncIterator]: async function* () {
          for (const event of mockStreamEvents) {
            yield event
          }
        }
      }

      mockOpenAIClient.responses.create.mockResolvedValue(mockAsyncIterable)

      const events = []
      for await (const event of client.stream({ input: 'Hello' })) {
        events.push(event)
      }

      expect(events).toEqual(mockStreamEvents)
      expect(mockOpenAIClient.responses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          stream: true,
          model: 'gpt-5',
          input: 'Hello'
        })
      )
    })

    it('should yield complete response for non-streaming', async () => {
      const mockResponse = {
        id: 'resp-123',
        output: { type: 'text', text: 'Hello world' }
      }

      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse)

      const events = []
      for await (const event of client.stream({ input: 'Hello' })) {
        events.push(event)
      }

      expect(events).toEqual([mockResponse])
    })

    it('should log streaming events when logPaths enabled', async () => {
      const configWithLogging = { ...mockConfig, logPaths: true }
      const clientWithLogging = new OpenAIResponseClient(mockOpenAIClient as any, configWithLogging)

      const mockAsyncIterable = {
        [Symbol.asyncIterator]: async function* () {
          yield { object: 'response.content.text.delta', text: 'Hello' }
        }
      }

      mockOpenAIClient.responses.create.mockResolvedValue(mockAsyncIterable)

      const events = []
      for await (const event of clientWithLogging.stream({ input: 'Hello' })) {
        events.push(event)
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        '[ResponseClient] Streaming parameters:',
        expect.stringContaining('stream')
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        '[ResponseClient] Stream event type:',
        'response.content.text.delta'
      )
    })

    it('should log non-streaming response when logPaths enabled', async () => {
      const configWithLogging = { ...mockConfig, logPaths: true }
      const clientWithLogging = new OpenAIResponseClient(mockOpenAIClient as any, configWithLogging)

      const mockResponse = { id: 'resp-123', output: { type: 'text', text: 'Hello' } }
      mockOpenAIClient.responses.create.mockResolvedValue(mockResponse)

      const events = []
      for await (const event of clientWithLogging.stream({ input: 'Hello' })) {
        events.push(event)
      }

      expect(consoleSpy).toHaveBeenCalledWith('[ResponseClient] Non-streaming response')
    })

    it('should handle streaming API errors with enhanced error message', async () => {
      const streamError = new Error('Streaming failed')
      mockOpenAIClient.responses.create.mockRejectedValue(streamError)

      const generator = client.stream({ input: 'Hello' })

      await expect(generator.next()).rejects.toThrow(
        'OpenAI Responses API streaming error: Streaming failed'
      )
    })

    it('should re-throw non-Error objects in streaming', async () => {
      const stringError = 'Streaming string error'
      mockOpenAIClient.responses.create.mockRejectedValue(stringError)

      const generator = client.stream({ input: 'Hello' })

      await expect(generator.next()).rejects.toBe(stringError)
    })
  })

  describe('followup', () => {
    const mockFollowupResponse = {
      id: 'resp-456',
      output: { type: 'text', text: 'Follow up response' }
    }

    beforeEach(() => {
      mockOpenAIClient.responses.create.mockResolvedValue(mockFollowupResponse)
    })

    it('should create followup with previous response ID', async () => {
      const params = {
        input: [{ type: 'input_text', text: 'Follow up question' }],
        previousResponseId: 'resp-123'
      }

      const result = await client.followup(params)

      expect(mockOpenAIClient.responses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-5',
          input: params.input,
          previous_response_id: 'resp-123'
        })
      )
      expect(result).toBe(mockFollowupResponse)
    })

    it('should include tools when provided', async () => {
      const params = {
        input: [{ type: 'input_text', text: 'Use a tool' }],
        previousResponseId: 'resp-123',
        tools: [{ type: 'function', function: { name: 'test_tool' } }]
      }

      await client.followup(params)

      expect(mockOpenAIClient.responses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: params.tools
        })
      )
    })

    it('should include max_output_tokens when provided', async () => {
      const params = {
        input: [{ type: 'input_text', text: 'Short response please' }],
        previousResponseId: 'resp-123',
        maxOutputTokens: 50
      }

      await client.followup(params)

      expect(mockOpenAIClient.responses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          max_output_tokens: 50
        })
      )
    })

    it('should not include optional parameters when not provided', async () => {
      const params = {
        input: [{ type: 'input_text', text: 'Basic followup' }],
        previousResponseId: 'resp-123'
      }

      await client.followup(params)

      const callArgs = mockOpenAIClient.responses.create.mock.calls[0][0]
      expect(callArgs).not.toHaveProperty('tools')
      expect(callArgs).not.toHaveProperty('max_output_tokens')
    })
  })

  describe('enhanceParams', () => {
    it('should enhance params with config values for GPT-5', () => {
      const params = { input: 'Hello' }

      // Access private method via bracket notation
      const enhanced = (client as any).enhanceParams(params)

      expect(enhanced).toEqual({
        input: 'Hello',
        model: 'gpt-5',
        store: true,
        text: { verbosity: 'medium' },
        reasoning: { effort: 'medium' }
      })
    })

    it('should not add GPT-5 params for non-GPT-5 models', () => {
      const params = { input: 'Hello', model: 'gpt-4o' }

      const enhanced = (client as any).enhanceParams(params)

      expect(enhanced).toEqual({
        input: 'Hello',
        model: 'gpt-4o',
        store: true
        // No text or reasoning params
      })
    })

    it('should preserve existing include array when adding encrypted reasoning', () => {
      const configWithEncrypted = { ...mockConfig, includeEncrypted: true }
      const clientWithEncrypted = new OpenAIResponseClient(mockOpenAIClient as any, configWithEncrypted)

      const params = {
        input: 'Hello',
        include: ['existing.field']
      }

      const enhanced = (clientWithEncrypted as any).enhanceParams(params)

      expect(enhanced.include).toEqual(['existing.field', 'reasoning.encrypted_content'])
    })
  })

  describe('normalizeUsage', () => {
    it('should normalize OpenAI Responses API usage to Chat Completions format', () => {
      const responsesUsage = {
        input_tokens: 15,
        output_tokens: 25,
        total_tokens: 40
      }

      const normalized = client.normalizeUsage(responsesUsage)

      expect(normalized).toEqual({
        prompt_tokens: 15,
        completion_tokens: 25,
        total_tokens: 40
      })
    })

    it('should handle zero usage values', () => {
      const responsesUsage = {
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0
      }

      const normalized = client.normalizeUsage(responsesUsage)

      expect(normalized).toEqual({
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      })
    })
  })

  describe('integration scenarios', () => {
    it('should handle complete GPT-5 configuration with all features', async () => {
      const fullConfig: DeepConfig = {
        ...mockConfig,
        enableSummary: true,
        includeEncrypted: true,
        logPaths: true
      }

      const fullFeaturesClient = new OpenAIResponseClient(mockOpenAIClient as any, fullConfig)

      mockOpenAIClient.responses.create.mockResolvedValue({
        id: 'resp-full',
        output: { type: 'text', text: 'Full response' },
        usage: { input_tokens: 20, output_tokens: 30, total_tokens: 50 }
      })

      await fullFeaturesClient.create({ input: 'Complex request' })

      expect(mockOpenAIClient.responses.create).toHaveBeenCalledWith({
        input: 'Complex request',
        model: 'gpt-5',
        store: false, // Disabled for encrypted
        text: { verbosity: 'medium' },
        reasoning: { effort: 'medium', summary: 'auto' },
        include: ['reasoning.encrypted_content']
      })

      // Should log parameters and response
      expect(consoleSpy).toHaveBeenCalledWith(
        '[ResponseClient] Parameters:',
        expect.any(String)
      )
    })
  })
})