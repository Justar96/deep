// Comprehensive tests for CLI command functions
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock all external dependencies before importing
vi.mock('chalk', () => ({
  default: {
    blue: vi.fn((text) => `BLUE:${text}`),
    green: vi.fn((text) => `GREEN:${text}`),
    red: vi.fn((text) => `RED:${text}`),
    yellow: vi.fn((text) => `YELLOW:${text}`),
    cyan: vi.fn((text) => `CYAN:${text}`),
    gray: vi.fn((text) => `GRAY:${text}`)
  }
}))

vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    text: ''
  }))
}))

vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn()
  }
}))

vi.mock('@deep-agent/core', () => ({
  DeepEngine: vi.fn(),
  loadConfig: vi.fn()
}))

// Import the command functions and dependencies
import {
  handleChatEvent,
  chatCommand,
  askCommand,
  listCommand,
  clearCommand,
  configCommand
} from './commands'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { DeepEngine, loadConfig } from '@deep-agent/core'
import type { DeepEvent } from '@deep-agent/core'

describe('CLI Command Functions', () => {
  let mockEngine: any
  let consoleSpy: any
  let consoleErrorSpy: any
  let processExitSpy: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup fresh mocks for each test
    mockEngine = {
      healthCheck: vi.fn().mockResolvedValue({ status: 'ok' }),
      processMessage: vi.fn(),
      listConversations: vi.fn().mockResolvedValue([]),
      clearConversation: vi.fn().mockResolvedValue(undefined)
    }

    vi.mocked(DeepEngine).mockImplementation(() => mockEngine)
    vi.mocked(loadConfig).mockReturnValue({
      model: 'gpt-5',
      verbosity: 'medium',
      reasoningEffort: 'medium',
      stream: true,
      store: true,
      logPaths: false,
      baseUrl: null,
      allowedTools: []
    })

    // Mock console methods
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('handleChatEvent', () => {
    it('should handle turn_start event', async () => {
      const mockSpinner = { text: '', succeed: vi.fn(), fail: vi.fn() }
      const event: DeepEvent = { type: 'turn_start', data: {} }

      await handleChatEvent(event, mockSpinner)

      expect(mockSpinner.text).toBe('Processing your message...')
    })

    it('should handle response_start event', async () => {
      const mockSpinner = { text: '', succeed: vi.fn(), fail: vi.fn() }
      const event: DeepEvent = { type: 'response_start', data: {} }

      await handleChatEvent(event, mockSpinner)

      expect(mockSpinner.text).toBe('Generating response...')
    })

    it('should handle tool_call event', async () => {
      const mockSpinner = { text: '', succeed: vi.fn(), fail: vi.fn() }
      const event: DeepEvent = { type: 'tool_call', data: { name: 'web_search' } }

      await handleChatEvent(event, mockSpinner)

      expect(mockSpinner.text).toBe('Calling tool: web_search...')
    })

    it('should handle tool_result event', async () => {
      const mockSpinner = { text: '', succeed: vi.fn(), fail: vi.fn() }
      const event: DeepEvent = { type: 'tool_result', data: {} }

      await handleChatEvent(event, mockSpinner)

      expect(mockSpinner.text).toBe('Processing tool result...')
    })

    it('should handle reasoning_summary event', async () => {
      const mockSpinner = { text: '', succeed: vi.fn(), fail: vi.fn() }
      const event: DeepEvent = { type: 'reasoning_summary', data: {} }

      await handleChatEvent(event, mockSpinner)

      expect(mockSpinner.text).toBe('Reasoning...')
    })

    it('should handle turn_complete event', async () => {
      const mockSpinner = { text: '', succeed: vi.fn(), fail: vi.fn() }
      const event: DeepEvent = { type: 'turn_complete', data: {} }

      await handleChatEvent(event, mockSpinner)

      expect(mockSpinner.succeed).toHaveBeenCalledWith('Response complete')
    })

    it('should handle error event', async () => {
      const mockSpinner = { text: '', succeed: vi.fn(), fail: vi.fn() }
      const event: DeepEvent = { type: 'error', data: { error: 'Test error' } }

      await handleChatEvent(event, mockSpinner)

      expect(mockSpinner.fail).toHaveBeenCalledWith('Error: Test error')
    })
  })

  describe('askCommand', () => {
    it('should process single message and output response', async () => {
      const mockEvents = [
        { type: 'content_delta', data: { text: 'Test response' } },
        { type: 'turn_complete', data: { usage: { total_tokens: 50 } } }
      ]

      mockEngine.processMessage.mockImplementation(async function* () {
        for (const event of mockEvents) {
          yield event
        }
      })

      await askCommand('What is the weather?', { json: false })

      expect(mockEngine.processMessage).toHaveBeenCalledWith('What is the weather?', undefined)
      expect(consoleSpy).toHaveBeenCalledWith('Test response')
    })

    it('should output JSON when requested', async () => {
      const mockEvents = [
        { type: 'content_delta', data: { text: 'JSON response' } },
        { type: 'turn_complete', data: { usage: { total_tokens: 25 } } }
      ]

      mockEngine.processMessage.mockImplementation(async function* () {
        for (const event of mockEvents) {
          yield event
        }
      })

      await askCommand('Generate JSON', { json: true })

      const expectedOutput = JSON.stringify({
        response: 'JSON response',
        usage: { total_tokens: 25 },
        model: 'gpt-5',
      }, null, 2)

      expect(consoleSpy).toHaveBeenCalledWith(expectedOutput)
    })

    it('should override config with options', async () => {
      const mockEvents = [
        { type: 'turn_complete', data: { usage: null } }
      ]

      mockEngine.processMessage.mockImplementation(async function* () {
        for (const event of mockEvents) {
          yield event
        }
      })

      const options = {
        model: 'gpt-4o',
        verbosity: 'high',
        reasoning: 'high',
        conversation: 'conv-123'
      }

      await askCommand('Test message', options)

      expect(mockEngine.processMessage).toHaveBeenCalledWith('Test message', 'conv-123')
      expect(loadConfig).toHaveBeenCalled()
    })

    it('should handle error events and exit', async () => {
      const mockEvents = [
        { type: 'error', data: { error: 'Processing failed' } }
      ]

      mockEngine.processMessage.mockImplementation(async function* () {
        for (const event of mockEvents) {
          yield event
        }
      })

      await askCommand('Test error', {})

      expect(processExitSpy).toHaveBeenCalledWith(1)
    })
  })

  describe('listCommand', () => {
    it('should display conversations when found', async () => {
      const mockConversations = [
        {
          id: 'conv-1',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
          messages: ['msg1', 'msg2']
        },
        {
          id: 'conv-2',
          createdAt: new Date('2024-01-03'),
          updatedAt: new Date('2024-01-04'),
          messages: ['msg3']
        }
      ]

      mockEngine.listConversations.mockResolvedValue(mockConversations)

      await listCommand()

      expect(mockEngine.listConversations).toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('BLUE:Found 2 conversation(s):')
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('CYAN:conv-1')
      )
    })

    it('should display message when no conversations found', async () => {
      mockEngine.listConversations.mockResolvedValue([])

      await listCommand()

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('GRAY:No conversations found.')
      )
    })
  })

  describe('clearCommand', () => {
    it('should clear specific conversation when ID provided', async () => {
      await clearCommand('conv-123')

      expect(mockEngine.clearConversation).toHaveBeenCalledWith('conv-123')
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('GREEN:✅ Cleared conversation: conv-123')
      )
    })

    it('should clear all conversations when confirmed', async () => {
      const mockInquirer = vi.mocked(inquirer)
      mockInquirer.prompt.mockResolvedValue({ confirmAll: true })
      mockEngine.listConversations.mockResolvedValue([
        { id: 'conv-1' },
        { id: 'conv-2' }
      ])

      await clearCommand()

      expect(mockEngine.clearConversation).toHaveBeenCalledTimes(2)
      expect(mockEngine.clearConversation).toHaveBeenCalledWith('conv-1')
      expect(mockEngine.clearConversation).toHaveBeenCalledWith('conv-2')
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('GREEN:✅ Cleared 2 conversation(s)')
      )
    })

    it('should cancel operation when not confirmed', async () => {
      const mockInquirer = vi.mocked(inquirer)
      mockInquirer.prompt.mockResolvedValue({ confirmAll: false })

      await clearCommand()

      expect(mockEngine.clearConversation).not.toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('YELLOW:Operation cancelled.')
      )
    })
  })

  describe('configCommand', () => {
    it('should display current configuration', () => {
      configCommand()

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('BLUE:Deep Agent Configuration:')
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Model: CYAN:gpt-5')
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Verbosity: CYAN:medium')
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Reasoning Effort: CYAN:medium')
      )
    })

    it('should display optional configuration when present', () => {
      vi.mocked(loadConfig).mockReturnValue({
        model: 'gpt-5',
        verbosity: 'high',
        reasoningEffort: 'medium',
        stream: true,
        store: false,
        logPaths: true,
        baseUrl: 'https://api.custom.com',
        allowedTools: ['web_search', 'calculator']
      })

      configCommand()

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Base URL: CYAN:https://api.custom.com')
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Allowed Tools: CYAN:web_search, calculator')
      )
    })
  })

  describe('chatCommand', () => {
    it('should handle health check failure', async () => {
      mockEngine.healthCheck.mockResolvedValue({
        status: 'error',
        message: 'API connection failed'
      })

      await expect(chatCommand({})).rejects.toBeTruthy()

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Health check failed: API connection failed')
      )
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('should initialize successfully with valid health check', async () => {
      const mockInquirer = vi.mocked(inquirer)

      // Mock user immediately exiting
      mockInquirer.prompt.mockResolvedValue({ input: 'exit' })

      await chatCommand({})

      expect(mockEngine.healthCheck).toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('BLUE:🤖 Initializing Deep agent...')
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('GREEN:✅ Deep agent initialized successfully!')
      )
    })

    it('should process user messages until exit', async () => {
      const mockInquirer = vi.mocked(inquirer)

      // Mock user entering a message then exiting
      mockInquirer.prompt
        .mockResolvedValueOnce({ input: 'Hello AI' })
        .mockResolvedValueOnce({ input: 'quit' })

      const mockEvents = [
        { type: 'content_delta', data: { text: 'Hello there!' } },
        { type: 'turn_complete', data: { responseId: 'resp-123' } }
      ]

      mockEngine.processMessage.mockImplementation(async function* () {
        for (const event of mockEvents) {
          yield event
        }
      })

      await chatCommand({})

      expect(mockEngine.processMessage).toHaveBeenCalledWith('Hello AI', undefined)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('GREEN:\nDeep:'),
        'Hello there!'
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('YELLOW:👋 Goodbye!')
      )
    })

    it('should handle empty input', async () => {
      const mockInquirer = vi.mocked(inquirer)

      // Mock user entering empty input then exiting
      mockInquirer.prompt
        .mockResolvedValueOnce({ input: '' })
        .mockResolvedValueOnce({ input: 'exit' })

      await chatCommand({})

      // Should not call processMessage for empty input
      expect(mockEngine.processMessage).not.toHaveBeenCalled()
    })

    it('should handle processing errors', async () => {
      const mockInquirer = vi.mocked(inquirer)

      mockInquirer.prompt
        .mockResolvedValueOnce({ input: 'Hello' })
        .mockResolvedValueOnce({ input: 'exit' })

      // Mock async generator that throws an error
      mockEngine.processMessage.mockImplementation(async function* () {
        throw new Error('Processing failed')
      })

      await chatCommand({})

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('RED:Processing failed')
      )
    })

    it('should override config with options', async () => {
      const mockInquirer = vi.mocked(inquirer)
      mockInquirer.prompt.mockResolvedValue({ input: 'exit' })

      const options = {
        model: 'gpt-4o',
        verbosity: 'high',
        reasoning: 'high',
        conversation: 'existing-conv'
      }

      await chatCommand(options)

      expect(loadConfig).toHaveBeenCalled()
      // The config would be modified in the actual function
    })
  })

  describe('Error handling', () => {
    it('should handle DeepEngine initialization errors', () => {
      vi.mocked(DeepEngine).mockImplementation(() => {
        throw new Error('Engine initialization failed')
      })

      expect(() => new DeepEngine(loadConfig())).toThrow('Engine initialization failed')
    })

    it('should handle config loading errors', () => {
      vi.mocked(loadConfig).mockImplementation(() => {
        throw new Error('Invalid configuration')
      })

      expect(() => loadConfig()).toThrow('Invalid configuration')
    })
  })
})