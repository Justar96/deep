// Configuration tests
import { describe, it, expect, beforeEach } from 'vitest'
import { loadConfig, validateConfig } from '@deep-agent/core'

describe('Configuration Management', () => {
  beforeEach(() => {
    // Clear env vars before each test
    delete process.env.OPENAI_API_KEY
    delete process.env.OPENAI_MODEL
    delete process.env.OPENAI_VERBOSITY
    delete process.env.OPENAI_REASONING_EFFORT
  })

  it('should load default configuration', () => {
    process.env.OPENAI_API_KEY = 'test-key'
    
    const config = loadConfig()
    
    expect(config.apiKey).toBe('test-key')
    expect(config.model).toBe('gpt-5')
    expect(config.verbosity).toBe('medium')
    expect(config.reasoningEffort).toBe('medium')
    expect(config.useResponsesDefault).toBe(true) // Default value
    expect(config.stream).toBe(true)
    expect(config.store).toBe(true)
  })

  it('should load configuration from environment variables', () => {
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.OPENAI_MODEL = 'gpt-5-mini'
    process.env.OPENAI_VERBOSITY = 'high'
    process.env.OPENAI_REASONING_EFFORT = 'low'
    process.env.OPENAI_USE_RESPONSES_DEFAULT = 'true'
    process.env.OPENAI_STREAM = 'false'
    
    const config = loadConfig()
    
    expect(config.model).toBe('gpt-5-mini')
    expect(config.verbosity).toBe('high')
    expect(config.reasoningEffort).toBe('low')
    expect(config.useResponsesDefault).toBe(true)
    expect(config.stream).toBe(false)
  })

  it('should handle encrypted reasoning configuration', () => {
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.OPENAI_RESP_INCLUDE_ENCRYPTED = 'true'
    
    const config = loadConfig()
    
    expect(config.includeEncrypted).toBe(true)
    expect(config.store).toBe(false) // Should be disabled when encrypted is enabled
  })

  it('should parse allowed tools from environment', () => {
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.FIBER_ALLOWED_TOOLS = 'web_search,file_search,code_interpreter'
    
    const config = loadConfig()
    
    expect(config.allowedTools).toEqual(['web_search', 'file_search', 'code_interpreter'])
  })

  it('should validate configuration schema', () => {
    const validConfig = {
      apiKey: 'test-key',
      model: 'gpt-5',
      verbosity: 'medium' as const,
      reasoningEffort: 'medium' as const,
      useResponsesDefault: true,
      stream: true,
      store: true,
      enableSummary: false,
      includeEncrypted: false,
      allowedTools: [],
      logPaths: false,
      conversation: {
        compression: {
          enabled: true,
          threshold: 0.7,
          strategy: 'summarize' as const,
          preserveContext: true,
          maxCompressionRatio: 0.3
        },
        maxTokens: 8000,
        curationEnabled: true,
        healthCheckInterval: 30
      }
    }

    expect(() => validateConfig(validConfig)).not.toThrow()
  })

  it('should throw on invalid configuration', () => {
    const invalidConfig = {
      apiKey: '', // Empty API key should fail
      model: 'gpt-5',
      verbosity: 'invalid' as any,
      reasoningEffort: 'medium' as const,
      useResponsesDefault: true,
      stream: true,
      store: true,
      enableSummary: false,
      includeEncrypted: false,
      allowedTools: [],
      logPaths: false,
      conversation: {
        compression: {
          enabled: true,
          threshold: 0.7,
          strategy: 'summarize' as const,
          preserveContext: true,
          maxCompressionRatio: 0.3
        },
        maxTokens: 8000,
        curationEnabled: true,
        healthCheckInterval: 30
      }
    }

    expect(() => validateConfig(invalidConfig)).toThrow()
  })
})