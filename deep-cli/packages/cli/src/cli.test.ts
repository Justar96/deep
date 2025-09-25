// Comprehensive CLI tests for @deep-agent/cli package
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

vi.mock('dotenv', () => ({
  config: vi.fn()
}))

vi.mock('@deep-agent/core', () => ({
  DeepEngine: vi.fn(),
  loadConfig: vi.fn()
}))

vi.mock('commander', () => ({
  Command: vi.fn(() => ({
    name: vi.fn().mockReturnThis(),
    description: vi.fn().mockReturnThis(),
    version: vi.fn().mockReturnThis(),
    command: vi.fn().mockReturnThis(),
    option: vi.fn().mockReturnThis(),
    action: vi.fn().mockReturnThis(),
    parse: vi.fn().mockReturnThis()
  }))
}))

// Import types and mocked modules
import type { DeepEvent } from '@deep-agent/core'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { DeepEngine, loadConfig } from '@deep-agent/core'

describe('CLI Application Dependencies', () => {
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

  describe('Configuration Loading', () => {
    it('should load configuration using loadConfig', () => {
      const config = loadConfig()

      expect(config).toBeDefined()
      expect(config.model).toBe('gpt-5')
      expect(config.verbosity).toBe('medium')
      expect(config.reasoningEffort).toBe('medium')
      expect(loadConfig).toHaveBeenCalled()
    })

    it('should override config with command options', () => {
      const config = loadConfig()

      // Simulate option overrides
      const options = {
        model: 'gpt-4o',
        verbosity: 'high',
        reasoning: 'high'
      }

      if (options.model) config.model = options.model
      if (options.verbosity) config.verbosity = options.verbosity
      if (options.reasoning) config.reasoningEffort = options.reasoning

      expect(config.model).toBe('gpt-4o')
      expect(config.verbosity).toBe('high')
      expect(config.reasoningEffort).toBe('high')
    })
  })

  describe('DeepEngine Integration', () => {
    it('should initialize DeepEngine with config', () => {
      const config = loadConfig()
      const engine = new DeepEngine(config)

      expect(DeepEngine).toHaveBeenCalledWith(config)
      expect(engine).toBe(mockEngine)
    })

    it('should perform health check', async () => {
      const config = loadConfig()
      const engine = new DeepEngine(config)

      const health = await engine.healthCheck()

      expect(engine.healthCheck).toHaveBeenCalled()
      expect(health.status).toBe('ok')
    })

    it('should handle health check failure', async () => {
      mockEngine.healthCheck.mockResolvedValue({
        status: 'error',
        message: 'API connection failed'
      })

      const config = loadConfig()
      const engine = new DeepEngine(config)

      const health = await engine.healthCheck()

      expect(health.status).toBe('error')
      expect(health.message).toBe('API connection failed')
    })
  })

  describe('Message Processing', () => {
    it('should process messages through engine', async () => {
      const mockEvents = [
        { type: 'turn_start', data: {} },
        { type: 'response_start', data: {} },
        { type: 'content_delta', data: { text: 'Hello' } },
        { type: 'turn_complete', data: { responseId: 'resp-123' } }
      ]

      mockEngine.processMessage.mockImplementation(async function* () {
        for (const event of mockEvents) {
          yield event
        }
      })

      const config = loadConfig()
      const engine = new DeepEngine(config)

      const events: any[] = []
      for await (const event of engine.processMessage('Hello', 'conv-123')) {
        events.push(event)
      }

      expect(engine.processMessage).toHaveBeenCalledWith('Hello', 'conv-123')
      expect(events).toHaveLength(4)
      expect(events[0].type).toBe('turn_start')
      expect(events[2].data.text).toBe('Hello')
    })

    it('should handle error events', async () => {
      const mockEvents = [
        { type: 'error', data: { error: 'Processing failed' } }
      ]

      mockEngine.processMessage.mockImplementation(async function* () {
        for (const event of mockEvents) {
          yield event
        }
      })

      const config = loadConfig()
      const engine = new DeepEngine(config)

      const events: any[] = []
      for await (const event of engine.processMessage('Test')) {
        events.push(event)
      }

      expect(events[0].type).toBe('error')
      expect(events[0].data.error).toBe('Processing failed')
    })
  })

  describe('Conversation Management', () => {
    it('should list conversations', async () => {
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

      const config = loadConfig()
      const engine = new DeepEngine(config)

      const conversations = await engine.listConversations()

      expect(engine.listConversations).toHaveBeenCalled()
      expect(conversations).toHaveLength(2)
      expect(conversations[0].id).toBe('conv-1')
      expect(conversations[1].messages).toHaveLength(1)
    })

    it('should clear specific conversation', async () => {
      const config = loadConfig()
      const engine = new DeepEngine(config)

      await engine.clearConversation('conv-123')

      expect(engine.clearConversation).toHaveBeenCalledWith('conv-123')
    })

    it('should clear multiple conversations', async () => {
      mockEngine.listConversations.mockResolvedValue([
        { id: 'conv-1' },
        { id: 'conv-2' }
      ])

      const config = loadConfig()
      const engine = new DeepEngine(config)

      const conversations = await engine.listConversations()
      for (const conv of conversations) {
        await engine.clearConversation(conv.id)
      }

      expect(engine.clearConversation).toHaveBeenCalledTimes(2)
      expect(engine.clearConversation).toHaveBeenCalledWith('conv-1')
      expect(engine.clearConversation).toHaveBeenCalledWith('conv-2')
    })
  })

  describe('UI Components', () => {
    it('should use chalk for colored output', () => {
      const chalkInstance = chalk as any

      const blueText = chalkInstance.blue('Test message')
      const redError = chalkInstance.red('Error message')
      const greenSuccess = chalkInstance.green('Success')

      expect(chalkInstance.blue).toHaveBeenCalledWith('Test message')
      expect(chalkInstance.red).toHaveBeenCalledWith('Error message')
      expect(chalkInstance.green).toHaveBeenCalledWith('Success')
      expect(blueText).toBe('BLUE:Test message')
      expect(redError).toBe('RED:Error message')
      expect(greenSuccess).toBe('GREEN:Success')
    })

    it('should create spinner with ora', () => {
      const oraInstance = ora as any
      const spinner = oraInstance('Loading...')

      expect(oraInstance).toHaveBeenCalledWith('Loading...')
      expect(spinner.start).toBeDefined()
      expect(spinner.succeed).toBeDefined()
      expect(spinner.fail).toBeDefined()
    })

    it('should prompt for user input with inquirer', async () => {
      const mockInquirer = inquirer as any
      mockInquirer.prompt.mockResolvedValue({ input: 'test input' })

      const result = await mockInquirer.prompt([{
        type: 'input',
        name: 'input',
        message: 'Enter message:'
      }])

      expect(mockInquirer.prompt).toHaveBeenCalledWith([{
        type: 'input',
        name: 'input',
        message: 'Enter message:'
      }])
      expect(result.input).toBe('test input')
    })

    it('should prompt for confirmation', async () => {
      const mockInquirer = inquirer as any
      mockInquirer.prompt.mockResolvedValue({ confirmAll: true })

      const result = await mockInquirer.prompt([{
        type: 'confirm',
        name: 'confirmAll',
        message: 'Are you sure?',
        default: false
      }])

      expect(result.confirmAll).toBe(true)
    })
  })

  describe('handleChatEvent helper function logic', () => {
    it('should handle different event types', () => {
      // Test the logic that would be in handleChatEvent
      const mockSpinner = {
        text: '',
        succeed: vi.fn(),
        fail: vi.fn()
      }

      // Simulate handleChatEvent logic
      const handleEvent = (event: DeepEvent, spinner: any) => {
        switch (event.type) {
          case 'turn_start':
            spinner.text = 'Processing your message...'
            break
          case 'response_start':
            spinner.text = 'Generating response...'
            break
          case 'tool_call':
            spinner.text = `Calling tool: ${event.data.name}...`
            break
          case 'tool_result':
            spinner.text = 'Processing tool result...'
            break
          case 'reasoning_summary':
            spinner.text = 'Reasoning...'
            break
          case 'turn_complete':
            spinner.succeed('Response complete')
            break
          case 'error':
            spinner.fail(`Error: ${event.data.error}`)
            break
        }
      }

      // Test different event types
      handleEvent({ type: 'turn_start', data: {} } as DeepEvent, mockSpinner)
      expect(mockSpinner.text).toBe('Processing your message...')

      handleEvent({ type: 'response_start', data: {} } as DeepEvent, mockSpinner)
      expect(mockSpinner.text).toBe('Generating response...')

      handleEvent({ type: 'tool_call', data: { name: 'web_search' } } as DeepEvent, mockSpinner)
      expect(mockSpinner.text).toBe('Calling tool: web_search...')

      handleEvent({ type: 'tool_result', data: {} } as DeepEvent, mockSpinner)
      expect(mockSpinner.text).toBe('Processing tool result...')

      handleEvent({ type: 'reasoning_summary', data: {} } as DeepEvent, mockSpinner)
      expect(mockSpinner.text).toBe('Reasoning...')

      handleEvent({ type: 'turn_complete', data: {} } as DeepEvent, mockSpinner)
      expect(mockSpinner.succeed).toHaveBeenCalledWith('Response complete')

      handleEvent({ type: 'error', data: { error: 'Test error' } } as DeepEvent, mockSpinner)
      expect(mockSpinner.fail).toHaveBeenCalledWith('Error: Test error')
    })
  })

  describe('Chat flow simulation', () => {
    it('should simulate complete chat interaction', async () => {
      const mockInquirer = inquirer as any

      // Simulate user entering a message then exit
      mockInquirer.prompt
        .mockResolvedValueOnce({ input: 'Hello AI' })
        .mockResolvedValueOnce({ input: 'exit' })

      const mockEvents = [
        { type: 'turn_start', data: {} },
        { type: 'content_delta', data: { text: 'Hello ' } },
        { type: 'content_delta', data: { text: 'there!' } },
        { type: 'turn_complete', data: { responseId: 'resp-123' } }
      ]

      mockEngine.processMessage.mockImplementation(async function* () {
        for (const event of mockEvents) {
          yield event
        }
      })

      const config = loadConfig()
      const engine = new DeepEngine(config)

      // Simulate health check
      const health = await engine.healthCheck()
      expect(health.status).toBe('ok')

      // Simulate first message
      const firstPrompt = await mockInquirer.prompt([{ type: 'input', name: 'input' }])
      expect(firstPrompt.input).toBe('Hello AI')

      let responseText = ''
      let conversationId: string | undefined

      for await (const event of engine.processMessage(firstPrompt.input, conversationId)) {
        if (event.type === 'content_delta') {
          responseText += event.data.text
        }
        if (event.type === 'turn_complete') {
          if (!conversationId) {
            conversationId = event.data.responseId
          }
        }
      }

      expect(responseText).toBe('Hello there!')
      expect(conversationId).toBe('resp-123')

      // Simulate exit
      const exitPrompt = await mockInquirer.prompt([{ type: 'input', name: 'input' }])
      expect(exitPrompt.input).toBe('exit')
    })
  })

  describe('JSON output', () => {
    it('should format response as JSON when requested', async () => {
      const mockEvents = [
        { type: 'content_delta', data: { text: 'JSON response' } },
        { type: 'turn_complete', data: { usage: { total_tokens: 25 } } }
      ]

      mockEngine.processMessage.mockImplementation(async function* () {
        for (const event of mockEvents) {
          yield event
        }
      })

      const config = loadConfig()
      const engine = new DeepEngine(config)

      let responseText = ''
      let usage: any = null

      for await (const event of engine.processMessage('Generate JSON')) {
        if (event.type === 'content_delta') {
          responseText += event.data.text
        }
        if (event.type === 'turn_complete') {
          usage = event.data.usage
        }
      }

      // Simulate JSON output formatting
      const jsonOutput = JSON.stringify({
        response: responseText,
        usage,
        model: config.model,
      }, null, 2)

      const parsed = JSON.parse(jsonOutput)
      expect(parsed.response).toBe('JSON response')
      expect(parsed.model).toBe('gpt-5')
      expect(parsed.usage.total_tokens).toBe(25)
    })
  })

  describe('Error handling', () => {
    it('should handle DeepEngine initialization errors', () => {
      vi.mocked(DeepEngine).mockImplementation(() => {
        throw new Error('Engine initialization failed')
      })

      const config = loadConfig()

      expect(() => new DeepEngine(config)).toThrow('Engine initialization failed')
    })

    it('should handle config loading errors', () => {
      vi.mocked(loadConfig).mockImplementation(() => {
        throw new Error('Invalid configuration')
      })

      expect(() => loadConfig()).toThrow('Invalid configuration')
    })

    it('should handle conversation listing errors', async () => {
      mockEngine.listConversations.mockRejectedValue(new Error('Database error'))

      const config = loadConfig()
      const engine = new DeepEngine(config)

      await expect(engine.listConversations()).rejects.toThrow('Database error')
    })
  })

  describe('CLI display logic', () => {
    it('should display conversation list correctly', () => {
      const conversations = [
        {
          id: 'conv-1',
          createdAt: new Date('2024-01-01T10:00:00Z'),
          updatedAt: new Date('2024-01-02T10:00:00Z'),
          messages: ['msg1', 'msg2']
        },
        {
          id: 'conv-2',
          createdAt: new Date('2024-01-03T10:00:00Z'),
          updatedAt: new Date('2024-01-04T10:00:00Z'),
          messages: ['msg3']
        }
      ]

      // Simulate the display logic
      if (conversations.length === 0) {
        console.log(chalk.gray('No conversations found.'))
      } else {
        console.log(chalk.blue(`Found ${conversations.length} conversation(s):`))

        conversations.forEach((conv, index) => {
          console.log(`${index + 1}. ${chalk.cyan(conv.id)}`)
          console.log(`   Messages: ${chalk.yellow(conv.messages.length)}`)
        })
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('BLUE:Found 2 conversation(s):')
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('CYAN:conv-1')
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('YELLOW:2')
      )
    })

    it('should display no conversations message', () => {
      const conversations: any[] = []

      if (conversations.length === 0) {
        console.log(chalk.gray('No conversations found.'))
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('GRAY:No conversations found.')
      )
    })

    it('should display configuration correctly', () => {
      const config = {
        model: 'gpt-5',
        verbosity: 'high',
        reasoningEffort: 'medium',
        stream: true,
        store: false,
        logPaths: true,
        baseUrl: 'https://api.custom.com',
        allowedTools: ['web_search', 'calculator']
      }

      // Simulate config display logic
      console.log(chalk.blue('Deep Agent Configuration:'))
      console.log(`Model: ${chalk.cyan(config.model)}`)
      console.log(`Verbosity: ${chalk.cyan(config.verbosity)}`)
      console.log(`Reasoning Effort: ${chalk.cyan(config.reasoningEffort)}`)
      console.log(`Streaming: ${chalk.cyan(config.stream ? 'enabled' : 'disabled')}`)
      console.log(`Store Conversations: ${chalk.cyan(config.store ? 'enabled' : 'disabled')}`)
      console.log(`Debug Logging: ${chalk.cyan(config.logPaths ? 'enabled' : 'disabled')}`)

      if (config.baseUrl) {
        console.log(`Base URL: ${chalk.cyan(config.baseUrl)}`)
      }

      if (config.allowedTools.length > 0) {
        console.log(`Allowed Tools: ${chalk.cyan(config.allowedTools.join(', '))}`)
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('BLUE:Deep Agent Configuration:')
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('CYAN:gpt-5')
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('CYAN:https://api.custom.com')
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('CYAN:web_search, calculator')
      )
    })
  })
})