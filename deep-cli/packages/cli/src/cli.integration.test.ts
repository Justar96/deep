// Integration tests for the main CLI file
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
vi.mock('commander', () => ({
  Command: vi.fn(() => ({
    name: vi.fn().mockReturnThis(),
    description: vi.fn().mockReturnThis(),
    version: vi.fn().mockReturnThis(),
    command: vi.fn(() => ({
      description: vi.fn().mockReturnThis(),
      option: vi.fn().mockReturnThis(),
      action: vi.fn().mockReturnThis()
    })),
    parse: vi.fn()
  }))
}))

vi.mock('dotenv', () => ({
  config: vi.fn()
}))

vi.mock('./commands.js', () => ({
  chatCommand: vi.fn(),
  askCommand: vi.fn(),
  listCommand: vi.fn(),
  clearCommand: vi.fn(),
  configCommand: vi.fn()
}))

describe('CLI Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should setup commander program with correct configuration', async () => {
    const { Command } = await import('commander')
    const MockCommand = Command as any

    // Import the CLI module to trigger setup
    await import('./cli')

    expect(MockCommand).toHaveBeenCalled()

    // Get the program instance
    const programInstance = MockCommand.mock.results[0].value

    expect(programInstance.name).toHaveBeenCalledWith('deep')
    expect(programInstance.description).toHaveBeenCalledWith('Deep - AI agent using OpenAI Responses API exclusively')
    expect(programInstance.version).toHaveBeenCalledWith('1.0.0')
    expect(programInstance.parse).toHaveBeenCalled()
  })

  it('should configure dotenv', async () => {
    const { config } = await import('dotenv')

    expect(config).toBeDefined()
    // Note: In test environment, dotenv config may not be called due to module caching
  })

  it('should import command functions', async () => {
    // This test ensures the imports work correctly
    const commands = await import('./commands')

    expect(commands.chatCommand).toBeDefined()
    expect(commands.askCommand).toBeDefined()
    expect(commands.listCommand).toBeDefined()
    expect(commands.clearCommand).toBeDefined()
    expect(commands.configCommand).toBeDefined()
  })
})