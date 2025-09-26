// Git Manager Test Suite - Sprint 3: IDE Context Integration
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GitManager } from '../git-manager.js'
import { execSync } from 'child_process'

// Mock child_process
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  spawn: vi.fn()
}))

describe('GitManager', () => {
  let gitManager: GitManager
  const mockProjectRoot = '/test/project'

  beforeEach(() => {
    vi.resetAllMocks()

    // Mock successful git commands by default
    vi.mocked(execSync).mockImplementation((command: string) => {
      if (command.includes('rev-parse --git-dir')) {
        return '.git\n'
      }
      if (command.includes('rev-parse --abbrev-ref HEAD')) {
        return 'main\n'
      }
      if (command.includes('status --porcelain')) {
        return ' M src/index.ts\n?? new-file.ts\n'
      }
      if (command.includes('log --pretty=format')) {
        return 'abc123|feat: add new feature|John Doe|2024-01-01 10:00:00 +0000|\nabc124|fix: bug fix|Jane Doe|2024-01-01 09:00:00 +0000|\n'
      }
      if (command.includes('diff-tree --no-commit-id')) {
        return 'src/index.ts\nsrc/utils.ts\n'
      }
      if (command.includes('remote get-url origin')) {
        return 'https://github.com/user/repo.git\n'
      }
      return ''
    })

    gitManager = new GitManager(mockProjectRoot)
  })

  afterEach(() => {
    gitManager.dispose()
  })

  describe('initialization', () => {
    it('should initialize with default git state', () => {
      const state = gitManager.getState()

      expect(state).toMatchObject({
        branch: expect.any(String),
        status: expect.any(String),
        recentCommits: expect.any(Array),
        stagedFiles: expect.any(Array),
        modifiedFiles: expect.any(Array),
        untrackedFiles: expect.any(Array),
        lastUpdate: expect.any(Date)
      })
    })

    it('should start watching git state changes', () => {
      expect(gitManager).toBeDefined()
      // Watch timer should be started automatically
    })
  })

  describe('git repository detection', () => {
    it('should detect git repository', async () => {
      await gitManager.refreshState()

      const state = gitManager.getState()
      expect(state.status).not.toBe('unknown')
    })

    it('should handle non-git directory', async () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('Not a git repository')
      })

      await gitManager.refreshState()

      const state = gitManager.getState()
      expect(state.status).toBe('unknown')
    })
  })

  describe('branch detection', () => {
    it('should get current branch', async () => {
      await gitManager.refreshState()

      const state = gitManager.getState()
      expect(state.branch).toBe('main')
    })

    it('should handle branch detection errors', async () => {
      vi.mocked(execSync).mockImplementation((command: string) => {
        if (command.includes('rev-parse --abbrev-ref HEAD')) {
          throw new Error('Not a git repository')
        }
        if (command.includes('rev-parse --git-dir')) {
          return '.git\n'
        }
        return ''
      })

      await gitManager.refreshState()

      const state = gitManager.getState()
      expect(state.branch).toBe('unknown')
    })
  })

  describe('status parsing', () => {
    it('should parse git status correctly', async () => {
      vi.mocked(execSync).mockImplementation((command: string) => {
        if (command.includes('status --porcelain')) {
          return 'M  staged-file.ts\n M modified-file.ts\n?? untracked-file.ts\nA  added-file.ts\nD  deleted-file.ts\n'
        }
        if (command.includes('rev-parse --git-dir')) {
          return '.git\n'
        }
        if (command.includes('rev-parse --abbrev-ref HEAD')) {
          return 'main\n'
        }
        return ''
      })

      await gitManager.refreshState()

      const state = gitManager.getState()
      expect(state.status).toBe('dirty')
      expect(state.stagedFiles).toContain('staged-file.ts')
      expect(state.stagedFiles).toContain('added-file.ts')
      expect(state.stagedFiles).toContain('deleted-file.ts')
      expect(state.modifiedFiles).toContain('modified-file.ts')
      expect(state.untrackedFiles).toContain('untracked-file.ts')
    })

    it('should detect clean repository', async () => {
      vi.mocked(execSync).mockImplementation((command: string) => {
        if (command.includes('status --porcelain')) {
          return '' // Clean status
        }
        if (command.includes('rev-parse --git-dir')) {
          return '.git\n'
        }
        if (command.includes('rev-parse --abbrev-ref HEAD')) {
          return 'main\n'
        }
        return ''
      })

      await gitManager.refreshState()

      const state = gitManager.getState()
      expect(state.status).toBe('clean')
      expect(state.stagedFiles).toHaveLength(0)
      expect(state.modifiedFiles).toHaveLength(0)
      expect(state.untrackedFiles).toHaveLength(0)
    })

    it('should handle status parsing errors', async () => {
      vi.mocked(execSync).mockImplementation((command: string) => {
        if (command.includes('status --porcelain')) {
          throw new Error('Git command failed')
        }
        if (command.includes('rev-parse --git-dir')) {
          return '.git\n'
        }
        if (command.includes('rev-parse --abbrev-ref HEAD')) {
          return 'main\n'
        }
        return ''
      })

      await gitManager.refreshState()

      const state = gitManager.getState()
      expect(state.status).toBe('unknown')
    })
  })

  describe('commit history', () => {
    it('should get commit history', async () => {
      const history = await gitManager.getHistory(5)

      expect(history).toHaveLength(2)
      expect(history[0]).toMatchObject({
        hash: expect.stringMatching(/^[a-f0-9]{7}$/),
        message: 'feat: add new feature',
        author: 'John Doe',
        date: expect.any(Date),
        filesChanged: expect.any(Array)
      })
    })

    it('should limit commit history', async () => {
      const history = await gitManager.getHistory(1)

      expect(history).toHaveLength(1)
    })

    it('should handle commit history errors', async () => {
      vi.mocked(execSync).mockImplementation((command: string) => {
        if (command.includes('log --pretty=format')) {
          throw new Error('Git log failed')
        }
        return ''
      })

      const history = await gitManager.getHistory(5)

      expect(history).toHaveLength(0)
    })

    it('should get files changed in commits', async () => {
      const history = await gitManager.getHistory(1)

      expect(history[0].filesChanged).toContain('src/index.ts')
      expect(history[0].filesChanged).toContain('src/utils.ts')
    })
  })

  describe('remote URL detection', () => {
    it('should get remote URL', async () => {
      await gitManager.refreshState()

      const state = gitManager.getState()
      expect(state.remoteUrl).toBe('https://github.com/user/repo.git')
    })

    it('should handle missing remote', async () => {
      vi.mocked(execSync).mockImplementation((command: string) => {
        if (command.includes('remote get-url origin')) {
          throw new Error('No remote found')
        }
        if (command.includes('rev-parse --git-dir')) {
          return '.git\n'
        }
        if (command.includes('rev-parse --abbrev-ref HEAD')) {
          return 'main\n'
        }
        if (command.includes('status --porcelain')) {
          return ''
        }
        return ''
      })

      await gitManager.refreshState()

      const state = gitManager.getState()
      expect(state.remoteUrl).toBeUndefined()
    })
  })

  describe('state change detection', () => {
    it('should emit state change events', (done) => {
      let eventReceived = false

      gitManager.onStateChange((state) => {
        eventReceived = true
        expect(state).toMatchObject({
          branch: expect.any(String),
          status: expect.any(String)
        })

        if (eventReceived) {
          done()
        }
      })

      // Trigger state refresh
      gitManager.refreshState()
    })

    it('should not emit events when state unchanged', async () => {
      let eventCount = 0

      gitManager.onStateChange(() => {
        eventCount++
      })

      // Initial refresh
      await gitManager.refreshState()
      const initialCount = eventCount

      // Refresh again with same state
      await gitManager.refreshState()

      // Should not increase event count since state didn't change
      expect(eventCount).toBe(initialCount)
    })

    it('should detect changes in branch', async () => {
      await gitManager.refreshState()
      const initialState = gitManager.getState()

      // Change branch response
      vi.mocked(execSync).mockImplementation((command: string) => {
        if (command.includes('rev-parse --abbrev-ref HEAD')) {
          return 'feature-branch\n'
        }
        if (command.includes('rev-parse --git-dir')) {
          return '.git\n'
        }
        if (command.includes('status --porcelain')) {
          return ''
        }
        return ''
      })

      let stateChanged = false
      gitManager.onStateChange(() => {
        stateChanged = true
      })

      await gitManager.refreshState()
      expect(stateChanged).toBe(true)
    })
  })

  describe('error handling', () => {
    it('should handle git command timeouts', async () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('Command timeout')
      })

      await gitManager.refreshState()

      const state = gitManager.getState()
      expect(state.status).toBe('unknown')
    })

    it('should handle malformed git output', async () => {
      vi.mocked(execSync).mockImplementation((command: string) => {
        if (command.includes('log --pretty=format')) {
          return 'malformed|output|missing|fields\n'
        }
        return ''
      })

      const history = await gitManager.getHistory(5)
      expect(history).toHaveLength(0)
    })
  })

  describe('watching and cleanup', () => {
    it('should stop watching on dispose', () => {
      expect(() => gitManager.dispose()).not.toThrow()
    })

    it('should clear event listeners on dispose', () => {
      const callback = vi.fn()
      gitManager.onStateChange(callback)

      gitManager.dispose()

      // After dispose, no events should be emitted
      gitManager.refreshState()
      setTimeout(() => {
        expect(callback).not.toHaveBeenCalled()
      }, 100)
    })
  })

  describe('exec command wrapper', () => {
    it('should execute git commands with proper options', async () => {
      await gitManager.refreshState()

      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('git'),
        expect.objectContaining({
          cwd: mockProjectRoot,
          encoding: 'utf8',
          timeout: 10000
        })
      )
    })
  })
})