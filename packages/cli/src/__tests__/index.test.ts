// Tests for index.ts exports
import { describe, it, expect, vi } from 'vitest'

// Mock the actual implementations
vi.mock('./cli.js', () => ({
  // Mock any exports from cli.js if needed
}))

vi.mock('./commands.js', () => ({
  chatCommand: vi.fn(),
  askCommand: vi.fn(),
  listCommand: vi.fn(),
  clearCommand: vi.fn(),
  configCommand: vi.fn(),
  handleChatEvent: vi.fn()
}))

describe('Index exports', () => {
  it('should export command functions', async () => {
    const index = await import('./index')

    // Verify that command functions are re-exported
    expect(index.chatCommand).toBeDefined()
    expect(index.askCommand).toBeDefined()
    expect(index.listCommand).toBeDefined()
    expect(index.clearCommand).toBeDefined()
    expect(index.configCommand).toBeDefined()
    expect(index.handleChatEvent).toBeDefined()
  })

  it('should have all expected exports', async () => {
    // This test ensures the index file properly re-exports everything
    const index = await import('./index')

    const expectedExports = [
      'chatCommand',
      'askCommand',
      'listCommand',
      'clearCommand',
      'configCommand',
      'handleChatEvent'
    ]

    expectedExports.forEach(exportName => {
      expect(index).toHaveProperty(exportName)
    })
  })
})