// Context Store Test Suite - Sprint 3: IDE Context Integration
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ContextStore } from '../context-store.js'
import type { DeepConfig, ContextDelta, FileChange } from '../../types/core-types.js'

// Mock dependencies
vi.mock('../git-manager.js', () => ({
  GitManager: vi.fn().mockImplementation(() => ({
    onStateChange: vi.fn(),
    refreshState: vi.fn(),
    getHistory: vi.fn().mockResolvedValue([]),
    getState: vi.fn().mockReturnValue({
      branch: 'main',
      status: 'clean',
      recentCommits: [],
      stagedFiles: [],
      modifiedFiles: [],
      untrackedFiles: [],
      lastUpdate: new Date()
    }),
    dispose: vi.fn()
  }))
}))

vi.mock('../file-watcher.js', () => ({
  FileWatcher: vi.fn().mockImplementation(() => ({
    onFileChange: vi.fn(),
    dispose: vi.fn()
  }))
}))

vi.mock('../context-analyzer.js', () => ({
  ContextAnalyzer: vi.fn().mockImplementation(() => ({
    filterRelevant: vi.fn(),
    analyzeRelevance: vi.fn().mockResolvedValue([])
  }))
}))

vi.mock('../context-compressor.js', () => ({
  ContextCompressor: vi.fn().mockImplementation(() => ({
    compress: vi.fn()
  }))
}))

describe('ContextStore', () => {
  let contextStore: ContextStore
  let mockConfig: DeepConfig

  beforeEach(() => {
    vi.resetAllMocks()

    mockConfig = {
      apiKey: 'test-key',
      model: 'gpt-5',
      useResponsesDefault: true,
      stream: true,
      store: true,
      verbosity: 'medium',
      reasoningEffort: 'medium',
      enableSummary: false,
      includeEncrypted: false,
      allowedTools: [],
      logPaths: false,
      conversation: {
        compression: {
          enabled: true,
          threshold: 0.7,
          strategy: 'summarize',
          preserveContext: true,
          maxCompressionRatio: 0.3
        },
        maxTokens: 8000,
        curationEnabled: true,
        healthCheckInterval: 30
      },
      tools: {
        confirmationEnabled: true,
        confirmationTimeoutMs: 30000,
        autoApprovalForLowRisk: true,
        auditTrailEnabled: true,
        sandboxingEnabled: false,
        emergencyStopEnabled: true,
        maxConcurrentExecutions: 5,
        executionTimeoutMs: 60000
      },
      context: {
        enabled: true,
        updateStrategy: 'smart',
        compressionEnabled: true,
        compressionThreshold: 4000,
        maxContextSize: 8000,
        refreshIntervalMs: 30000,
        trackFileChanges: true,
        trackCursorPosition: true,
        trackGitState: true,
        relevanceThreshold: 0.5
      }
    }

    contextStore = new ContextStore(mockConfig, '/test/project')
  })

  afterEach(() => {
    contextStore.dispose()
  })

  describe('initialization', () => {
    it('should initialize with default context', async () => {
      const context = await contextStore.getCurrentContext()

      expect(context).toMatchObject({
        openFiles: [],
        projectRoot: '/test/project',
        gitState: expect.objectContaining({
          branch: expect.any(String),
          status: expect.any(String)
        }),
        recentChanges: [],
        workspaceSettings: expect.objectContaining({
          extensions: [],
          language: 'typescript'
        }),
        tokenCount: expect.any(Number)
      })
    })

    it('should use current working directory if no project root provided', () => {
      const store = new ContextStore(mockConfig)
      expect(store).toBeDefined()
    })
  })

  describe('active file management', () => {
    it('should set active file correctly', async () => {
      await contextStore.setActiveFile('/test/project/src/index.ts')

      const context = await contextStore.getCurrentContext()
      expect(context.openFiles).toHaveLength(1)
      expect(context.openFiles[0]).toMatchObject({
        path: '/test/project/src/index.ts',
        isActive: true,
        timestamp: expect.any(Number)
      })
      expect(context.activeFile).toBe('/test/project/src/index.ts')
    })

    it('should move existing file to front when set as active', async () => {
      // Add two files
      await contextStore.addOpenFile('/test/project/src/a.ts')
      await contextStore.addOpenFile('/test/project/src/b.ts')

      // Set first file as active
      await contextStore.setActiveFile('/test/project/src/a.ts')

      const context = await contextStore.getCurrentContext()
      expect(context.openFiles[0].path).toBe('/test/project/src/a.ts')
      expect(context.openFiles[0].isActive).toBe(true)
      expect(context.openFiles[1].isActive).toBe(false)
    })

    it('should limit open files to maximum count', async () => {
      // Add 12 files (more than the 10 file limit)
      for (let i = 0; i < 12; i++) {
        await contextStore.addOpenFile(`/test/project/file${i}.ts`)
      }

      const context = await contextStore.getCurrentContext()
      expect(context.openFiles).toHaveLength(10)
    })
  })

  describe('cursor position tracking', () => {
    it('should set cursor position for active file', async () => {
      await contextStore.setActiveFile('/test/project/src/index.ts')
      await contextStore.setCursorPosition(10, 5)

      const context = await contextStore.getCurrentContext()
      expect(context.cursorPosition).toEqual({ line: 10, column: 5 })
      expect(context.openFiles[0].cursor).toEqual({ line: 10, character: 5 })
    })

    it('should update cursor position without active file', async () => {
      await contextStore.setCursorPosition(10, 5)

      const context = await contextStore.getCurrentContext()
      expect(context.cursorPosition).toEqual({ line: 10, column: 5 })
    })
  })

  describe('selected text tracking', () => {
    it('should set selected text correctly', async () => {
      await contextStore.setActiveFile('/test/project/src/index.ts')
      await contextStore.setSelectedText(
        'const test = "hello"',
        { line: 1, column: 0 },
        { line: 1, column: 20 }
      )

      const context = await contextStore.getCurrentContext()
      expect(context.selectedText).toEqual({
        content: 'const test = "hello"',
        startLine: 1,
        endLine: 1,
        startColumn: 0,
        endColumn: 20
      })
      expect(context.openFiles[0].selectedText).toBe('const test = "hello"')
    })

    it('should truncate long selected text', async () => {
      const longText = 'x'.repeat(20000) // Longer than 16KB limit
      await contextStore.setSelectedText(
        longText,
        { line: 1, column: 0 },
        { line: 100, column: 0 }
      )

      const context = await contextStore.getCurrentContext()
      expect(context.selectedText?.content).toHaveLength(16384)
    })
  })

  describe('file change tracking', () => {
    it('should track file changes', async () => {
      const change: FileChange = {
        filePath: '/test/project/src/test.ts',
        changeType: 'modified',
        timestamp: new Date()
      }

      await contextStore.trackFileChange(change)

      const context = await contextStore.getCurrentContext()
      expect(context.recentChanges).toContain(change)
    })

    it('should limit recent changes to 100 items', async () => {
      // Add 105 changes
      for (let i = 0; i < 105; i++) {
        await contextStore.trackFileChange({
          filePath: `/test/project/file${i}.ts`,
          changeType: 'modified',
          timestamp: new Date()
        })
      }

      const context = await contextStore.getCurrentContext()
      expect(context.recentChanges).toHaveLength(100)
    })
  })

  describe('file operations', () => {
    it('should add open file', async () => {
      await contextStore.addOpenFile('/test/project/src/test.ts')

      const context = await contextStore.getCurrentContext()
      expect(context.openFiles).toHaveLength(1)
      expect(context.openFiles[0].path).toBe('/test/project/src/test.ts')
      expect(context.openFiles[0].isActive).toBe(false)
    })

    it('should not duplicate open files', async () => {
      await contextStore.addOpenFile('/test/project/src/test.ts')
      await contextStore.addOpenFile('/test/project/src/test.ts')

      const context = await contextStore.getCurrentContext()
      expect(context.openFiles).toHaveLength(1)
    })

    it('should remove open file', async () => {
      await contextStore.addOpenFile('/test/project/src/test.ts')
      await contextStore.removeOpenFile('/test/project/src/test.ts')

      const context = await contextStore.getCurrentContext()
      expect(context.openFiles).toHaveLength(0)
    })
  })

  describe('context updates', () => {
    it('should apply context delta correctly', async () => {
      const delta: ContextDelta = {
        added: {},
        removed: [],
        modified: {
          activeFile: '/test/project/new-file.ts'
        },
        timestamp: new Date(),
        tokenDelta: 10,
        reason: 'test_update'
      }

      await contextStore.updateContext(delta)

      const context = await contextStore.getCurrentContext()
      expect(context.activeFile).toBe('/test/project/new-file.ts')
    })

    it('should emit context change events with debouncing', (done) => {
      let eventCount = 0
      contextStore.onContextChange(() => {
        eventCount++
      })

      // Multiple rapid updates should be debounced
      contextStore.setActiveFile('/test/project/file1.ts')
      contextStore.setActiveFile('/test/project/file2.ts')
      contextStore.setActiveFile('/test/project/file3.ts')

      // Check after debounce period
      setTimeout(() => {
        expect(eventCount).toBe(1) // Should be debounced to single event
        done()
      }, 400) // Wait longer than 300ms debounce
    })
  })

  describe('token counting', () => {
    it('should estimate token count', async () => {
      await contextStore.addOpenFile('/test/project/src/test.ts')
      await contextStore.setSelectedText('some code here', { line: 1, column: 0 }, { line: 1, column: 14 })

      const context = await contextStore.getCurrentContext()
      expect(context.tokenCount).toBeGreaterThan(0)
    })
  })

  describe('project structure refresh', () => {
    it('should refresh project structure without errors', async () => {
      await expect(contextStore.refreshProjectStructure()).resolves.not.toThrow()
    })

    it('should refresh workspace settings', async () => {
      await expect(contextStore.refreshWorkspaceSettings()).resolves.not.toThrow()
    })
  })

  describe('Git integration', () => {
    it('should update Git state', async () => {
      await expect(contextStore.updateGitState()).resolves.not.toThrow()
    })

    it('should get Git history', async () => {
      const history = await contextStore.getGitHistory(5)
      expect(Array.isArray(history)).toBe(true)
    })
  })

  describe('event handling', () => {
    it('should handle context change events', () => {
      const callback = vi.fn()
      contextStore.onContextChange(callback)

      // Trigger a change
      contextStore.setActiveFile('/test/project/test.ts')

      // Should register the callback
      expect(callback).not.toHaveBeenCalled() // Due to debouncing
    })

    it('should handle file change events', () => {
      const callback = vi.fn()
      contextStore.onFileChange(callback)

      // Should register the callback
      expect(callback).not.toHaveBeenCalled()
    })

    it('should handle Git state change events', () => {
      const callback = vi.fn()
      contextStore.onGitStateChange(callback)

      // Should register the callback
      expect(callback).not.toHaveBeenCalled()
    })
  })

  describe('path resolution', () => {
    it('should resolve relative paths correctly', async () => {
      await contextStore.setActiveFile('src/index.ts') // Relative path

      const context = await contextStore.getCurrentContext()
      expect(context.openFiles[0].path).toBe('/test/project/src/index.ts')
    })

    it('should handle absolute paths correctly', async () => {
      await contextStore.setActiveFile('/absolute/path/file.ts')

      const context = await contextStore.getCurrentContext()
      expect(context.openFiles[0].path).toBe('/absolute/path/file.ts')
    })
  })

  describe('cleanup', () => {
    it('should dispose resources properly', () => {
      expect(() => contextStore.dispose()).not.toThrow()
    })
  })
})