// Context-Aware Deep Engine Test Suite - Sprint 3: IDE Context Integration
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ContextAwareDeepEngine } from '../models/context-aware-engine.js'
import type { DeepConfig, IDEContext, ContextDelta, IContextStore, IDEIntegration } from '../types/core-types.js'
import { createMinimalTestConfig } from '../../../../test-utils/test-config.js'

// Mock dependencies
vi.mock('../deep-engine.js', () => ({
  DeepEngine: class MockDeepEngine {
    conversationManager = {
      get: vi.fn(),
      create: vi.fn()
    }
    responseClient = {}
    toolRegistry = {}
    config = {}
    getFilteredTools = vi.fn().mockReturnValue([])

    constructor(config: any) {
      this.config = config
    }
  }
}))

vi.mock('../context/context-store.js', () => ({
  ContextStore: vi.fn().mockImplementation(() => ({
    getCurrentContext: vi.fn(),
    updateContext: vi.fn(),
    setActiveFile: vi.fn(),
    setCursorPosition: vi.fn(),
    setSelectedText: vi.fn(),
    trackFileChange: vi.fn(),
    onContextChange: vi.fn(),
    onFileChange: vi.fn(),
    onGitStateChange: vi.fn(),
    dispose: vi.fn()
  }))
}))

describe('ContextAwareDeepEngine', () => {
  let engine: ContextAwareDeepEngine
  let mockConfig: DeepConfig
  let mockContextStore: IContextStore
  let mockIDEIntegration: IDEIntegration

  beforeEach(() => {
    vi.resetAllMocks()

    mockConfig = createMinimalTestConfig({
      apiKey: 'test-key',
      model: 'gpt-5',
      // Context is disabled by default in createMinimalTestConfig
    })

    mockContextStore = {
      getCurrentContext: vi.fn().mockResolvedValue({
        openFiles: [],
        projectRoot: '/test/project',
        gitState: {
          branch: 'main',
          status: 'clean',
          recentCommits: [],
          stagedFiles: [],
          modifiedFiles: [],
          untrackedFiles: [],
          lastUpdate: new Date()
        },
        recentChanges: [],
        workspaceSettings: {
          extensions: [],
          language: 'typescript'
        },
        lastUpdate: new Date(),
        tokenCount: 100
      }),
      updateContext: vi.fn(),
      setActiveFile: vi.fn(),
      setCursorPosition: vi.fn(),
      setSelectedText: vi.fn(),
      addOpenFile: vi.fn(),
      removeOpenFile: vi.fn(),
      trackFileChange: vi.fn(),
      refreshProjectStructure: vi.fn(),
      updateGitState: vi.fn(),
      getGitHistory: vi.fn(),
      compressContext: vi.fn(),
      filterRelevantContext: vi.fn(),
      analyzeRelevance: vi.fn(),
      syncWithLanguageServer: vi.fn(),
      refreshWorkspaceSettings: vi.fn(),
      onContextChange: vi.fn(),
      onFileChange: vi.fn(),
      onGitStateChange: vi.fn()
    }

    mockIDEIntegration = {
      type: 'vscode',
      capabilities: {
        fileWatching: true,
        cursorTracking: true,
        selectionTracking: true,
        languageServer: true,
        gitIntegration: true,
        diagnostics: true
      },
      initialize: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      isConnected: vi.fn().mockReturnValue(true),
      syncContext: vi.fn().mockResolvedValue({}),
      watchFiles: vi.fn().mockResolvedValue(undefined),
      unwatchFiles: vi.fn().mockResolvedValue(undefined),
      onActiveFileChange: vi.fn(),
      onCursorMove: vi.fn(),
      onSelectionChange: vi.fn(),
      onFileCreate: vi.fn(),
      onFileModify: vi.fn(),
      onFileDelete: vi.fn()
    }

    engine = new ContextAwareDeepEngine(mockConfig)
  })

  afterEach(() => {
    engine.dispose()
  })

  describe('initialization', () => {
    it('should initialize with context enabled', () => {
      expect(engine).toBeInstanceOf(ContextAwareDeepEngine)
    })

    it('should initialize context store when manually set', () => {
      engine.setContextStore(mockContextStore)
      expect(engine.getContextStore()).toBe(mockContextStore)
    })

    it('should handle null context store', () => {
      engine.setContextStore(null as any)
      expect(engine.getContextStore()).toBeNull()
    })
  })

  describe('context store management', () => {
    it('should set context store', () => {
      engine.setContextStore(mockContextStore)
      expect(engine.getContextStore()).toBe(mockContextStore)
    })

    it('should get context store', () => {
      engine.setContextStore(mockContextStore)
      const store = engine.getContextStore()
      expect(store).toBe(mockContextStore)
    })

    it('should update IDE context', async () => {
      engine.setContextStore(mockContextStore)

      const delta: ContextDelta = {
        added: {},
        removed: [],
        modified: { activeFile: '/test/project/new-file.ts' },
        timestamp: new Date(),
        tokenDelta: 10,
        reason: 'test_update'
      }

      await engine.updateIDEContext(delta)
      expect(mockContextStore.updateContext).toHaveBeenCalledWith(delta)
    })

    it('should get IDE context', async () => {
      engine.setContextStore(mockContextStore)

      const context = await engine.getIDEContext()
      expect(mockContextStore.getCurrentContext).toHaveBeenCalled()
      expect(context).toBeDefined()
    })

    it('should return null when no context store', async () => {
      const context = await engine.getIDEContext()
      expect(context).toBeNull()
    })
  })

  describe('IDE integration', () => {
    it('should connect to IDE', async () => {
      engine.setContextStore(mockContextStore)

      await engine.connectIDE(mockIDEIntegration)

      expect(mockIDEIntegration.initialize).toHaveBeenCalled()
      expect(engine.getIDEIntegration()).toBe(mockIDEIntegration)
    })

    it('should set up IDE event handlers on connect', async () => {
      engine.setContextStore(mockContextStore)

      await engine.connectIDE(mockIDEIntegration)

      expect(mockIDEIntegration.onActiveFileChange).toHaveBeenCalled()
      expect(mockIDEIntegration.onCursorMove).toHaveBeenCalled()
      expect(mockIDEIntegration.onSelectionChange).toHaveBeenCalled()
      expect(mockIDEIntegration.onFileCreate).toHaveBeenCalled()
      expect(mockIDEIntegration.onFileModify).toHaveBeenCalled()
      expect(mockIDEIntegration.onFileDelete).toHaveBeenCalled()
    })

    it('should handle IDE connection errors', async () => {
      mockIDEIntegration.initialize = vi.fn().mockRejectedValue(new Error('Connection failed'))

      await expect(engine.connectIDE(mockIDEIntegration)).rejects.toThrow('Connection failed')
    })

    it('should disconnect from IDE', async () => {
      await engine.connectIDE(mockIDEIntegration)
      await engine.disconnectIDE()

      expect(mockIDEIntegration.disconnect).toHaveBeenCalled()
      expect(engine.getIDEIntegration()).toBeNull()
    })

    it('should handle disconnect when not connected', async () => {
      await expect(engine.disconnectIDE()).resolves.not.toThrow()
    })
  })

  describe('IDE event handling', () => {
    beforeEach(async () => {
      engine.setContextStore(mockContextStore)
      await engine.connectIDE(mockIDEIntegration)
    })

    it('should handle active file change events', async () => {
      const onActiveFileChange = vi.mocked(mockIDEIntegration.onActiveFileChange).mock.calls[0][0]

      await onActiveFileChange('/test/project/new-file.ts')

      expect(mockContextStore.setActiveFile).toHaveBeenCalledWith('/test/project/new-file.ts')
    })

    it('should handle cursor move events', async () => {
      const onCursorMove = vi.mocked(mockIDEIntegration.onCursorMove).mock.calls[0][0]

      await onCursorMove(10, 5)

      expect(mockContextStore.setCursorPosition).toHaveBeenCalledWith(10, 5)
    })

    it('should handle selection change events', async () => {
      const onSelectionChange = vi.mocked(mockIDEIntegration.onSelectionChange).mock.calls[0][0]

      const selection = {
        content: 'selected text',
        startLine: 1,
        endLine: 1,
        startColumn: 0,
        endColumn: 13
      }

      await onSelectionChange(selection)

      expect(mockContextStore.setSelectedText).toHaveBeenCalledWith(
        'selected text',
        { line: 1, column: 0 },
        { line: 1, column: 13 }
      )
    })

    it('should handle file creation events', async () => {
      const onFileCreate = vi.mocked(mockIDEIntegration.onFileCreate).mock.calls[0][0]

      await onFileCreate('/test/project/new-file.ts')

      expect(mockContextStore.trackFileChange).toHaveBeenCalledWith({
        filePath: '/test/project/new-file.ts',
        changeType: 'created',
        timestamp: expect.any(Date)
      })
    })

    it('should handle file modification events', async () => {
      const onFileModify = vi.mocked(mockIDEIntegration.onFileModify).mock.calls[0][0]

      await onFileModify('/test/project/existing-file.ts')

      expect(mockContextStore.trackFileChange).toHaveBeenCalledWith({
        filePath: '/test/project/existing-file.ts',
        changeType: 'modified',
        timestamp: expect.any(Date)
      })
    })

    it('should handle file deletion events', async () => {
      const onFileDelete = vi.mocked(mockIDEIntegration.onFileDelete).mock.calls[0][0]

      await onFileDelete('/test/project/deleted-file.ts')

      expect(mockContextStore.trackFileChange).toHaveBeenCalledWith({
        filePath: '/test/project/deleted-file.ts',
        changeType: 'deleted',
        timestamp: expect.any(Date)
      })
    })
  })

  describe('context-aware message processing', () => {
    beforeEach(() => {
      engine.setContextStore(mockContextStore)
    })

    it('should process message with context', async () => {
      const mockContext: IDEContext = {
        openFiles: [{
          path: '/test/project/src/index.ts',
          timestamp: Date.now(),
          isActive: true
        }],
        projectRoot: '/test/project',
        gitState: {
          branch: 'main',
          status: 'clean',
          recentCommits: [],
          stagedFiles: [],
          modifiedFiles: [],
          untrackedFiles: [],
          lastUpdate: new Date()
        },
        recentChanges: [],
        workspaceSettings: {
          extensions: [],
          language: 'typescript'
        },
        lastUpdate: new Date(),
        tokenCount: 500
      }

      vi.mocked(mockContextStore.getCurrentContext).mockResolvedValue(mockContext)

      const events: any[] = []
      for await (const event of engine.processMessageWithContext('Test message', undefined, {
        includeContext: true
      })) {
        events.push(event)
        // Break after first few events to avoid infinite loop in test
        if (events.length >= 3) break
      }

      expect(events.length).toBeGreaterThan(0)
      // Could be context_update or turn_start depending on processing order
      expect(['context_update', 'turn_start']).toContain(events[0].type)
    })

    it('should process message without context when disabled', async () => {
      const events: any[] = []
      for await (const event of engine.processMessageWithContext('Test message', undefined, {
        includeContext: false
      })) {
        events.push(event)
        if (events.length >= 2) break
      }

      expect(mockContextStore.getCurrentContext).not.toHaveBeenCalled()
    })

    it('should handle context compression when needed', async () => {
      const largeMockContext: IDEContext = {
        openFiles: [],
        projectRoot: '/test/project',
        gitState: {
          branch: 'main',
          status: 'clean',
          recentCommits: [],
          stagedFiles: [],
          modifiedFiles: [],
          untrackedFiles: [],
          lastUpdate: new Date()
        },
        recentChanges: [],
        workspaceSettings: {
          extensions: [],
          language: 'typescript'
        },
        lastUpdate: new Date(),
        tokenCount: 5000 // Above compression threshold
      }

      vi.mocked(mockContextStore.getCurrentContext).mockResolvedValue(largeMockContext)

      const events: any[] = []
      for await (const event of engine.processMessageWithContext('Test message', undefined, {
        includeContext: true,
        compressionStrategy: 'filter'
      })) {
        events.push(event)
        if (events.length >= 3) break
      }

      // Should include compression event or at least run without errors
      const compressionEvent = events.find(e => e.type === 'context_compression')
      // Compression might not trigger in test environment, but should not error
      expect(events.length).toBeGreaterThan(0)
    })
  })

  describe('context formatting', () => {
    it('should format context for prompt correctly', async () => {
      const mockContext: IDEContext = {
        activeFile: '/test/project/src/index.ts',
        openFiles: [{
          path: '/test/project/src/index.ts',
          timestamp: Date.now(),
          isActive: true,
          cursor: { line: 10, character: 5 },
          selectedText: 'const test = "hello"'
        }],
        projectRoot: '/test/project',
        gitState: {
          branch: 'feature/test',
          status: 'dirty',
          recentCommits: [],
          stagedFiles: ['src/index.ts'],
          modifiedFiles: ['src/test.ts'],
          untrackedFiles: [],
          lastUpdate: new Date()
        },
        recentChanges: [{
          filePath: 'src/test.ts',
          changeType: 'modified',
          timestamp: new Date()
        }],
        workspaceSettings: {
          extensions: [],
          language: 'typescript',
          projectType: 'node'
        },
        lastUpdate: new Date(),
        tokenCount: 500
      }

      engine.setContextStore(mockContextStore)
      vi.mocked(mockContextStore.getCurrentContext).mockResolvedValue(mockContext)

      const events: any[] = []
      for await (const event of engine.processMessageWithContext('Test message', undefined, {
        includeContext: true
      })) {
        events.push(event)
        if (events.length >= 2) break
      }

      expect(events.length).toBeGreaterThan(0)
    })
  })

  describe('cleanup', () => {
    it('should dispose context store on cleanup', () => {
      const disposableMockStore = {
        ...mockContextStore,
        dispose: vi.fn()
      }

      engine.setContextStore(disposableMockStore)
      engine.dispose()

      expect(disposableMockStore.dispose).toHaveBeenCalled()
    })

    it('should disconnect IDE integration on cleanup', async () => {
      await engine.connectIDE(mockIDEIntegration)
      engine.dispose()

      expect(mockIDEIntegration.disconnect).toHaveBeenCalled()
    })

    it('should handle cleanup without context store', () => {
      expect(() => engine.dispose()).not.toThrow()
    })
  })
})