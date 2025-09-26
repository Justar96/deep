// Context Analyzer Test Suite - Sprint 3: IDE Context Integration
import { describe, it, expect, beforeEach } from 'vitest'
import { ContextAnalyzer } from '../context-analyzer.js'
import type { DeepConfig, IDEContext, FileChange } from '../../types.js'

describe('ContextAnalyzer', () => {
  let analyzer: ContextAnalyzer
  let mockConfig: DeepConfig
  let mockContext: IDEContext

  beforeEach(() => {
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

    mockContext = {
      activeFile: '/test/project/src/index.ts',
      openFiles: [
        {
          path: '/test/project/src/index.ts',
          timestamp: Date.now(),
          isActive: true
        },
        {
          path: '/test/project/src/utils.ts',
          timestamp: Date.now() - 5000,
          isActive: false
        }
      ],
      projectRoot: '/test/project',
      gitState: {
        branch: 'main',
        status: 'dirty',
        recentCommits: [],
        stagedFiles: ['src/index.ts'],
        modifiedFiles: ['src/utils.ts'],
        untrackedFiles: ['new-file.ts'],
        lastUpdate: new Date()
      },
      recentChanges: [
        {
          filePath: 'src/index.ts',
          changeType: 'modified',
          timestamp: new Date(Date.now() - 1000),
          relevanceScore: 0.8
        },
        {
          filePath: 'old-file.ts',
          changeType: 'modified',
          timestamp: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
          relevanceScore: 0.2
        }
      ],
      workspaceSettings: {
        extensions: [],
        language: 'typescript',
        projectType: 'node'
      },
      lastUpdate: new Date(),
      tokenCount: 500
    }

    analyzer = new ContextAnalyzer(mockConfig)
  })

  describe('relevance analysis', () => {
    it('should analyze file relevance correctly', async () => {
      const filePaths = ['/test/project/src/index.ts', '/test/project/src/utils.ts']
      const relevance = await analyzer.analyzeRelevance(filePaths, mockContext)

      expect(relevance).toHaveLength(2)
      expect(relevance[0].filePath).toBe('/test/project/src/index.ts')
      expect(relevance[0].relevanceScore).toBeGreaterThan(relevance[1].relevanceScore)
    })

    it('should sort results by relevance score descending', async () => {
      const filePaths = ['/test/project/src/utils.ts', '/test/project/src/index.ts']
      const relevance = await analyzer.analyzeRelevance(filePaths, mockContext)

      expect(relevance[0].relevanceScore).toBeGreaterThanOrEqual(relevance[1].relevanceScore)
    })

    it('should boost active file relevance', async () => {
      const filePaths = ['/test/project/src/index.ts', '/test/project/src/utils.ts']
      const relevance = await analyzer.analyzeRelevance(filePaths, mockContext)

      const activeFileRelevance = relevance.find(r => r.filePath === '/test/project/src/index.ts')
      const nonActiveFileRelevance = relevance.find(r => r.filePath === '/test/project/src/utils.ts')

      expect(activeFileRelevance?.relevanceScore).toBeGreaterThan(nonActiveFileRelevance?.relevanceScore || 0)
      expect(activeFileRelevance?.factors.currentlyOpen).toBe(true)
    })

    it('should boost recently modified files', async () => {
      const filePaths = ['src/index.ts', 'old-file.ts']
      const relevance = await analyzer.analyzeRelevance(filePaths, mockContext)

      const recentFile = relevance.find(r => r.filePath === 'src/index.ts')
      const oldFile = relevance.find(r => r.filePath === 'old-file.ts')

      expect(recentFile?.factors.recentlyModified).toBe(true)
      expect(oldFile?.factors.recentlyModified).toBe(false)
    })
  })

  describe('file type scoring', () => {
    it('should give higher scores to source code files', async () => {
      const codeFiles = ['/test/project/src/index.ts', '/test/project/src/component.tsx']
      const otherFiles = ['/test/project/README.md', '/test/project/data.json']

      const codeRelevance = await analyzer.analyzeRelevance(codeFiles, mockContext)
      const otherRelevance = await analyzer.analyzeRelevance(otherFiles, mockContext)

      // Code files should generally have higher base scores
      const avgCodeScore = codeRelevance.reduce((sum, r) => sum + r.relevanceScore, 0) / codeRelevance.length
      const avgOtherScore = otherRelevance.reduce((sum, r) => sum + r.relevanceScore, 0) / otherRelevance.length

      expect(avgCodeScore).toBeGreaterThan(avgOtherScore)
    })

    it('should score test files appropriately', async () => {
      const testFiles = ['/test/project/src/index.test.ts', '/test/project/src/component.spec.tsx']
      const relevance = await analyzer.analyzeRelevance(testFiles, mockContext)

      expect(relevance.every(r => r.relevanceScore > 0)).toBe(true)
    })
  })

  describe('file relationships', () => {
    it('should detect files in same directory as related', async () => {
      const mockContextWithActive = {
        ...mockContext,
        openFiles: [{
          path: '/test/project/src/components/Button.tsx',
          timestamp: Date.now(),
          isActive: true
        }]
      }

      const relatedFiles = ['/test/project/src/components/Input.tsx']
      const unrelatedFiles = ['/test/project/src/utils/helpers.ts']

      const relatedRelevance = await analyzer.analyzeRelevance(relatedFiles, mockContextWithActive)
      const unrelatedRelevance = await analyzer.analyzeRelevance(unrelatedFiles, mockContextWithActive)

      const relatedScore = relatedRelevance[0].relevanceScore
      const unrelatedScore = unrelatedRelevance[0].relevanceScore

      expect(relatedScore).toBeGreaterThan(unrelatedScore)
    })

    it('should detect test file relationships', async () => {
      const mockContextWithActive = {
        ...mockContext,
        openFiles: [{
          path: '/test/project/src/utils.ts',
          timestamp: Date.now(),
          isActive: true
        }]
      }

      const testFiles = ['/test/project/src/utils.test.ts']
      const relevance = await analyzer.analyzeRelevance(testFiles, mockContextWithActive)

      expect(relevance[0].factors.relatedToActiveFile).toBe(true)
    })
  })

  describe('git status scoring', () => {
    it('should boost modified files', async () => {
      const modifiedFiles = ['src/utils.ts'] // In mockContext.gitState.modifiedFiles
      const normalFiles = ['/test/project/src/other.ts']

      const modifiedRelevance = await analyzer.analyzeRelevance(modifiedFiles, mockContext)
      const normalRelevance = await analyzer.analyzeRelevance(normalFiles, mockContext)

      expect(modifiedRelevance[0].relevanceScore).toBeGreaterThan(normalRelevance[0].relevanceScore)
    })

    it('should boost staged files', async () => {
      const stagedFiles = ['src/index.ts'] // In mockContext.gitState.stagedFiles
      const normalFiles = ['/test/project/src/other.ts']

      const stagedRelevance = await analyzer.analyzeRelevance(stagedFiles, mockContext)
      const normalRelevance = await analyzer.analyzeRelevance(normalFiles, mockContext)

      expect(stagedRelevance[0].relevanceScore).toBeGreaterThan(normalRelevance[0].relevanceScore)
    })
  })

  describe('context filtering', () => {
    it('should filter context based on relevance threshold', async () => {
      const filtered = await analyzer.filterRelevant(mockContext, 0.7)

      expect(filtered.openFiles.length).toBeLessThanOrEqual(mockContext.openFiles.length)
      expect(filtered.recentChanges.length).toBeLessThanOrEqual(mockContext.recentChanges.length)
    })

    it('should preserve high-relevance items', async () => {
      const filtered = await analyzer.filterRelevant(mockContext, 0.3)

      // Active file should always be preserved
      const activeFile = filtered.openFiles.find(f => f.isActive)
      expect(activeFile).toBeDefined()
    })

    it('should filter out low-relevance recent changes', async () => {
      const filtered = await analyzer.filterRelevant(mockContext, 0.6)

      // Recent change with score 0.8 should be kept, 0.2 should be filtered
      const highRelevanceChange = filtered.recentChanges.find(c => c.filePath === 'src/index.ts')
      const lowRelevanceChange = filtered.recentChanges.find(c => c.filePath === 'old-file.ts')

      expect(highRelevanceChange).toBeDefined()
      expect(lowRelevanceChange).toBeUndefined()
    })
  })

  describe('directory scoring', () => {
    it('should penalize deeply nested files', async () => {
      const shallowFiles = ['/test/project/src/index.ts']
      const deepFiles = ['/test/project/src/very/deep/nested/path/file.ts']

      const shallowRelevance = await analyzer.analyzeRelevance(shallowFiles, mockContext)
      const deepRelevance = await analyzer.analyzeRelevance(deepFiles, mockContext)

      expect(shallowRelevance[0].relevanceScore).toBeGreaterThan(deepRelevance[0].relevanceScore)
    })

    it('should boost important directories', async () => {
      const srcFiles = ['/test/project/src/index.ts']
      const rootFiles = ['/test/project/config.js']

      const srcRelevance = await analyzer.analyzeRelevance(srcFiles, mockContext)
      const rootRelevance = await analyzer.analyzeRelevance(rootFiles, mockContext)

      expect(srcRelevance[0].relevanceScore).toBeGreaterThan(rootRelevance[0].relevanceScore)
    })

    it('should penalize node_modules and build directories', async () => {
      const sourceFiles = ['/test/project/src/index.ts']
      const nodeModulesFiles = ['/test/project/node_modules/package/index.js']
      const buildFiles = ['/test/project/dist/bundle.js']

      const sourceRelevance = await analyzer.analyzeRelevance(sourceFiles, mockContext)
      const nodeModulesRelevance = await analyzer.analyzeRelevance(nodeModulesFiles, mockContext)
      const buildRelevance = await analyzer.analyzeRelevance(buildFiles, mockContext)

      expect(sourceRelevance[0].relevanceScore).toBeGreaterThan(nodeModulesRelevance[0].relevanceScore)
      expect(sourceRelevance[0].relevanceScore).toBeGreaterThan(buildRelevance[0].relevanceScore)
    })
  })

  describe('last access time calculation', () => {
    it('should use open file timestamp when available', async () => {
      const filePaths = ['/test/project/src/index.ts']
      const relevance = await analyzer.analyzeRelevance(filePaths, mockContext)

      expect(relevance[0].lastAccessed.getTime()).toBeGreaterThan(0)
    })

    it('should use recent change timestamp when file not open', async () => {
      const filePaths = ['src/index.ts']
      const relevance = await analyzer.analyzeRelevance(filePaths, mockContext)

      expect(relevance[0].lastAccessed.getTime()).toBeGreaterThan(0)
    })

    it('should fallback to epoch for unknown files', async () => {
      const filePaths = ['/test/project/unknown-file.ts']
      const relevance = await analyzer.analyzeRelevance(filePaths, mockContext)

      expect(relevance[0].lastAccessed.getTime()).toBe(0)
    })
  })

  describe('conversation reference analysis', () => {
    it('should count file mentions in conversation', async () => {
      const filePaths = ['/test/project/src/index.ts', '/test/project/src/utils.ts']
      const conversationText = 'Please modify index.ts and update the imports. The index.ts file needs refactoring.'

      const references = await analyzer.analyzeConversationReferences(filePaths, conversationText)

      expect(references.get('/test/project/src/index.ts')).toBe(2) // Mentioned twice
      expect(references.get('/test/project/src/utils.ts')).toBe(0) // Not mentioned
    })

    it('should be case insensitive', async () => {
      const filePaths = ['/test/project/src/Index.ts']
      const conversationText = 'Please check INDEX.ts and index.TS files'

      const references = await analyzer.analyzeConversationReferences(filePaths, conversationText)

      expect(references.get('/test/project/src/Index.ts')).toBe(2)
    })
  })

  describe('change relevance determination', () => {
    it('should consider recent changes as relevant', async () => {
      const recentChange: FileChange = {
        filePath: 'src/new.ts',
        changeType: 'created',
        timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
        relevanceScore: 0.4
      }

      const filtered = await analyzer.filterRelevant({
        ...mockContext,
        recentChanges: [recentChange]
      }, 0.5)

      // Should be included despite low relevance score because it's recent
      expect(filtered.recentChanges.some(c => c.filePath === 'src/new.ts')).toBe(true)
    })

    it('should consider open file changes as relevant', async () => {
      const change: FileChange = {
        filePath: '/test/project/src/index.ts', // This file is open
        changeType: 'modified',
        timestamp: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        relevanceScore: 0.3
      }

      const filtered = await analyzer.filterRelevant({
        ...mockContext,
        recentChanges: [change]
      }, 0.5)

      // Should be included because file is open despite low relevance score and old timestamp
      expect(filtered.recentChanges.some(c => c.filePath === '/test/project/src/index.ts')).toBe(true)
    })
  })
})