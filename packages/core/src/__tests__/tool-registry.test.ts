// Comprehensive tests for BasicToolRegistry
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Import after setting up any necessary mocks
const { BasicToolRegistry } = await import('@deep-agent/core')

describe('BasicToolRegistry', () => {
  let registry: InstanceType<typeof BasicToolRegistry>

  beforeEach(() => {
    registry = new BasicToolRegistry()
  })

  describe('constructor', () => {
    it('should initialize with empty maps', () => {
      const emptyRegistry = new BasicToolRegistry()

      // The registry should have default tools
      const trustedTools = emptyRegistry.getTools(true)
      const untrustedTools = emptyRegistry.getTools(false)

      expect(trustedTools).toBeInstanceOf(Array)
      expect(untrustedTools).toBeInstanceOf(Array)
    })

    it('should initialize default tools', () => {
      const trustedTools = registry.getTools(true)
      const untrustedTools = registry.getTools(false)

      // Should have default trusted tool
      const timeToolExists = trustedTools.some(tool => tool.name === 'get_current_time')
      expect(timeToolExists).toBe(true)

      // Should have default untrusted tool
      const echoToolExists = untrustedTools.some(tool => tool.name === 'echo_tool')
      expect(echoToolExists).toBe(true)
    })
  })

  describe('getTools', () => {
    beforeEach(() => {
      // Register additional test tools
      registry.registerTool(
        { type: 'function', name: 'test_trusted', description: 'Test trusted tool' },
        vi.fn().mockResolvedValue('trusted result'),
        true
      )

      registry.registerTool(
        { type: 'function', name: 'test_untrusted', description: 'Test untrusted tool' },
        vi.fn().mockResolvedValue('untrusted result'),
        false
      )
    })

    it('should return trusted tools when trusted=true', () => {
      const tools = registry.getTools(true)

      const toolNames = tools.map(tool => tool.name)
      expect(toolNames).toContain('get_current_time') // default trusted
      expect(toolNames).toContain('test_trusted')
      expect(toolNames).not.toContain('echo_tool') // untrusted tool
      expect(toolNames).not.toContain('test_untrusted')
    })

    it('should return untrusted tools when trusted=false', () => {
      const tools = registry.getTools(false)

      const toolNames = tools.map(tool => tool.name)
      expect(toolNames).toContain('echo_tool') // default untrusted
      expect(toolNames).toContain('test_untrusted')
      expect(toolNames).not.toContain('get_current_time') // trusted tool
      expect(toolNames).not.toContain('test_trusted')
    })

    it('should default to trusted=true', () => {
      const toolsDefault = registry.getTools()
      const toolsExplicitTrue = registry.getTools(true)

      expect(toolsDefault).toEqual(toolsExplicitTrue)
    })

    it('should return empty array when no tools are registered', () => {
      const emptyRegistry = new BasicToolRegistry()

      // Clear default tools by creating a registry without initialization
      const registryWithoutDefaults = Object.create(BasicToolRegistry.prototype)
      registryWithoutDefaults.trustedTools = new Map()
      registryWithoutDefaults.untrustedTools = new Map()
      registryWithoutDefaults.executors = new Map()

      expect(registryWithoutDefaults.getTools(true)).toEqual([])
      expect(registryWithoutDefaults.getTools(false)).toEqual([])
    })
  })

  describe('executeToolCall', () => {
    const mockExecutor = vi.fn()

    beforeEach(() => {
      vi.clearAllMocks()
      registry.registerTool(
        { type: 'function', name: 'test_execute', description: 'Test execution' },
        mockExecutor,
        true
      )
    })

    it('should execute tool call with correct parameters', async () => {
      mockExecutor.mockResolvedValue('execution result')

      const result = await registry.executeToolCall('test_execute', 'test input', 'call-123')

      expect(mockExecutor).toHaveBeenCalledWith('test input', 'call-123')
      expect(result).toBe('execution result')
    })

    it('should throw error when tool executor not found', async () => {
      await expect(
        registry.executeToolCall('non_existent_tool', 'input', 'call-456')
      ).rejects.toThrow('Tool executor not found: non_existent_tool')
    })

    it('should handle executor errors gracefully', async () => {
      const error = new Error('Executor failed')
      mockExecutor.mockRejectedValue(error)

      const result = await registry.executeToolCall('test_execute', 'input', 'call-789')

      expect(result).toBe('Error executing test_execute: Executor failed')
    })

    it('should handle non-Error exceptions', async () => {
      mockExecutor.mockRejectedValue('String error')

      const result = await registry.executeToolCall('test_execute', 'input', 'call-abc')

      expect(result).toBe('Error executing test_execute: Unknown error')
    })

    it('should handle async executor functions', async () => {
      const asyncExecutor = vi.fn().mockImplementation(async (input: string) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return `Processed: ${input}`
      })

      registry.registerTool(
        { type: 'function', name: 'async_tool', description: 'Async tool' },
        asyncExecutor,
        true
      )

      const result = await registry.executeToolCall('async_tool', 'async input', 'call-async')

      expect(result).toBe('Processed: async input')
      expect(asyncExecutor).toHaveBeenCalledWith('async input', 'call-async')
    })
  })

  describe('registerTool', () => {
    const mockExecutor = vi.fn().mockResolvedValue('mock result')

    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should register trusted tool correctly', () => {
      const tool = {
        type: 'function',
        name: 'new_trusted_tool',
        description: 'New trusted tool'
      }

      registry.registerTool(tool, mockExecutor, true)

      const trustedTools = registry.getTools(true)
      const toolExists = trustedTools.some(t => t.name === 'new_trusted_tool')
      expect(toolExists).toBe(true)

      const untrustedTools = registry.getTools(false)
      const notInUntrusted = untrustedTools.every(t => t.name !== 'new_trusted_tool')
      expect(notInUntrusted).toBe(true)
    })

    it('should register untrusted tool correctly', () => {
      const tool = {
        type: 'function',
        name: 'new_untrusted_tool',
        description: 'New untrusted tool'
      }

      registry.registerTool(tool, mockExecutor, false)

      const untrustedTools = registry.getTools(false)
      const toolExists = untrustedTools.some(t => t.name === 'new_untrusted_tool')
      expect(toolExists).toBe(true)

      const trustedTools = registry.getTools(true)
      const notInTrusted = trustedTools.every(t => t.name !== 'new_untrusted_tool')
      expect(notInTrusted).toBe(true)
    })

    it('should default to trusted=true', () => {
      const tool = {
        type: 'function',
        name: 'default_trusted_tool',
        description: 'Default trusted'
      }

      registry.registerTool(tool, mockExecutor) // No third parameter

      const trustedTools = registry.getTools(true)
      const toolExists = trustedTools.some(t => t.name === 'default_trusted_tool')
      expect(toolExists).toBe(true)
    })

    it('should register executor for tool execution', async () => {
      const tool = {
        type: 'function',
        name: 'executable_tool',
        description: 'Tool with executor'
      }

      registry.registerTool(tool, mockExecutor, true)

      await registry.executeToolCall('executable_tool', 'test', 'call-id')

      expect(mockExecutor).toHaveBeenCalledWith('test', 'call-id')
    })

    it('should handle tools without name property', () => {
      const toolWithoutName = {
        type: 'custom',
        description: 'Tool without name'
      }

      // Should not throw, but also should not register
      registry.registerTool(toolWithoutName, mockExecutor, true)

      const tools = registry.getTools(true)
      const hasUnnamedTool = tools.some(t => t.description === 'Tool without name')
      expect(hasUnnamedTool).toBe(false)
    })

    it('should overwrite existing tool with same name', () => {
      const tool1 = {
        type: 'function',
        name: 'duplicate_tool',
        description: 'First version'
      }

      const tool2 = {
        type: 'function',
        name: 'duplicate_tool',
        description: 'Second version'
      }

      const executor1 = vi.fn().mockResolvedValue('result 1')
      const executor2 = vi.fn().mockResolvedValue('result 2')

      registry.registerTool(tool1, executor1, true)
      registry.registerTool(tool2, executor2, true)

      const tools = registry.getTools(true)
      const duplicateTools = tools.filter(t => t.name === 'duplicate_tool')

      expect(duplicateTools).toHaveLength(1)
      expect(duplicateTools[0].description).toBe('Second version')
    })
  })

  describe('default tools integration', () => {
    describe('get_current_time tool', () => {
      it('should execute get_current_time with default timezone', async () => {
        const result = await registry.executeToolCall('get_current_time', '{}', 'time-call')

        expect(result).toMatch(/Current time in UTC:/)
        expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/)
      })

      it('should execute get_current_time with specific timezone', async () => {
        const input = JSON.stringify({ timezone: 'America/New_York' })
        const result = await registry.executeToolCall('get_current_time', input, 'time-call-ny')

        expect(result).toMatch(/Current time in America\/New_York:/)
        expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/)
      })

      it('should handle invalid timezone gracefully', async () => {
        const input = JSON.stringify({ timezone: 'Invalid/Timezone' })
        const result = await registry.executeToolCall('get_current_time', input, 'time-call-invalid')

        expect(result).toMatch(/Error getting time for timezone Invalid\/Timezone:/)
      })

      it('should handle malformed JSON input', async () => {
        const result = await registry.executeToolCall('get_current_time', 'invalid json', 'time-call-bad')

        expect(result).toMatch(/Error executing get_current_time:/)
      })
    })

    describe('echo_tool', () => {
      it('should echo input with prefix', async () => {
        const result = await registry.executeToolCall('echo_tool', 'Hello World', 'echo-call')

        expect(result).toBe('Echo: Hello World')
      })

      it('should handle empty input', async () => {
        const result = await registry.executeToolCall('echo_tool', '', 'echo-empty')

        expect(result).toBe('Echo: ')
      })

      it('should be registered as untrusted tool', () => {
        const untrustedTools = registry.getTools(false)
        const echoTool = untrustedTools.find(t => t.name === 'echo_tool')

        expect(echoTool).toBeTruthy()
        expect(echoTool?.description).toMatch(/echoes back/i)
      })
    })
  })

  describe('edge cases and robustness', () => {
    it('should handle multiple tool registrations in sequence', () => {
      const tools = [
        { type: 'function', name: 'tool1', description: 'First' },
        { type: 'function', name: 'tool2', description: 'Second' },
        { type: 'function', name: 'tool3', description: 'Third' }
      ]

      tools.forEach((tool, index) => {
        registry.registerTool(tool, vi.fn().mockResolvedValue(`result ${index + 1}`), true)
      })

      const registeredTools = registry.getTools(true)
      const newToolNames = registeredTools
        .filter(t => ['tool1', 'tool2', 'tool3'].includes(t.name))
        .map(t => t.name)
        .sort()

      expect(newToolNames).toEqual(['tool1', 'tool2', 'tool3'])
    })

    it('should maintain separation between trusted and untrusted tools', () => {
      registry.registerTool(
        { type: 'function', name: 'separation_test', description: 'Test' },
        vi.fn(),
        true
      )

      registry.registerTool(
        { type: 'function', name: 'separation_test', description: 'Test' },
        vi.fn(),
        false
      )

      const trustedTools = registry.getTools(true)
      const untrustedTools = registry.getTools(false)

      const trustedHasTool = trustedTools.some(t => t.name === 'separation_test')
      const untrustedHasTool = untrustedTools.some(t => t.name === 'separation_test')

      expect(trustedHasTool).toBe(true)
      expect(untrustedHasTool).toBe(true)
    })

    it('should handle complex tool parameters', () => {
      const complexTool = {
        type: 'function',
        name: 'complex_tool',
        description: 'Complex tool with parameters',
        parameters: {
          type: 'object',
          properties: {
            param1: { type: 'string', description: 'First param' },
            param2: { type: 'number', description: 'Second param' },
            param3: {
              type: 'object',
              properties: {
                nested: { type: 'boolean' }
              }
            }
          }
        }
      }

      registry.registerTool(complexTool, vi.fn().mockResolvedValue('complex result'), true)

      const tools = registry.getTools(true)
      const registeredTool = tools.find(t => t.name === 'complex_tool')

      expect(registeredTool).toBeTruthy()
      expect(registeredTool?.parameters).toEqual(complexTool.parameters)
    })
  })
})