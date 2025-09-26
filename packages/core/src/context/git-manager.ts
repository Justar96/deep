// Git Manager - Git state tracking and management
import { EventEmitter } from 'events'
import { execSync, spawn } from 'child_process'
import { promisify } from 'util'
import { readdir, stat } from 'fs/promises'
import type { GitContext, GitCommit } from '../types.js'

/**
 * Manages Git state tracking for IDE context integration
 * Provides real-time Git status, branch info, and commit history
 */
export class GitManager {
  private eventEmitter = new EventEmitter()
  private gitState: GitContext
  private watchTimer: NodeJS.Timeout | undefined
  private readonly watchIntervalMs = 5000 // Check Git state every 5 seconds

  constructor(private readonly projectRoot: string) {
    this.gitState = {
      branch: 'unknown',
      status: 'unknown',
      recentCommits: [],
      stagedFiles: [],
      modifiedFiles: [],
      untrackedFiles: [],
      lastUpdate: new Date()
    }

    this.startWatching()
    this.refreshState() // Initial state
  }

  private startWatching(): void {
    this.watchTimer = setInterval(() => {
      this.refreshState()
    }, this.watchIntervalMs)
  }

  async refreshState(): Promise<void> {
    try {
      if (!await this.isGitRepository()) {
        this.gitState.status = 'unknown'
        return
      }

      const previousState = { ...this.gitState }

      // Get current branch
      this.gitState.branch = await this.getCurrentBranch()

      // Get repository status
      await this.updateRepositoryStatus()

      // Get recent commits
      this.gitState.recentCommits = await this.getHistory(10)

      // Get remote URL
      this.gitState.remoteUrl = await this.getRemoteUrl()

      this.gitState.lastUpdate = new Date()

      // Check if state changed
      if (this.hasStateChanged(previousState, this.gitState)) {
        this.eventEmitter.emit('stateChange', this.gitState)
      }
    } catch (error) {
      console.error('Failed to refresh Git state:', error)
      this.gitState.status = 'unknown'
    }
  }

  private async isGitRepository(): Promise<boolean> {
    try {
      await this.execGit('rev-parse --git-dir')
      return true
    } catch {
      return false
    }
  }

  private async getCurrentBranch(): Promise<string> {
    try {
      const result = await this.execGit('rev-parse --abbrev-ref HEAD')
      return result.trim()
    } catch {
      return 'unknown'
    }
  }

  private async updateRepositoryStatus(): Promise<void> {
    try {
      // Get status porcelain format
      const status = await this.execGit('status --porcelain')

      this.gitState.stagedFiles = []
      this.gitState.modifiedFiles = []
      this.gitState.untrackedFiles = []

      const lines = status.trim().split('\n').filter(line => line.length > 0)

      for (const line of lines) {
        const statusCode = line.substring(0, 2)
        const filePath = line.substring(3)

        // Staged files (index status)
        if (statusCode[0] !== ' ' && statusCode[0] !== '?') {
          this.gitState.stagedFiles.push(filePath)
        }

        // Modified files (working tree status)
        if (statusCode[1] === 'M' || statusCode[1] === 'D') {
          this.gitState.modifiedFiles.push(filePath)
        }

        // Untracked files
        if (statusCode === '??') {
          this.gitState.untrackedFiles.push(filePath)
        }
      }

      // Determine overall status
      if (this.gitState.stagedFiles.length > 0 ||
          this.gitState.modifiedFiles.length > 0 ||
          this.gitState.untrackedFiles.length > 0) {
        this.gitState.status = 'dirty'
      } else {
        this.gitState.status = 'clean'
      }
    } catch (error) {
      console.error('Failed to get Git status:', error)
      this.gitState.status = 'unknown'
    }
  }

  async getHistory(limit = 10): Promise<GitCommit[]> {
    try {
      const result = await this.execGit(
        `log --pretty=format:"%H|%s|%an|%ad|%D" --date=iso -n ${limit}`
      )

      const lines = result.trim().split('\n').filter(line => line.length > 0)
      const commits: GitCommit[] = []

      for (const line of lines) {
        const [hash, message, author, dateStr] = line.split('|')

        if (hash && message && author && dateStr) {
          // Get files changed in this commit
          const filesChanged = await this.getCommitFiles(hash)

          commits.push({
            hash: hash.substring(0, 7), // Short hash
            message: message.trim(),
            author: author.trim(),
            date: new Date(dateStr.trim()),
            filesChanged
          })
        }
      }

      return commits
    } catch (error) {
      console.error('Failed to get Git history:', error)
      return []
    }
  }

  private async getCommitFiles(hash: string): Promise<string[]> {
    try {
      const result = await this.execGit(`diff-tree --no-commit-id --name-only -r ${hash}`)
      return result.trim().split('\n').filter(line => line.length > 0)
    } catch {
      return []
    }
  }

  private async getRemoteUrl(): Promise<string | undefined> {
    try {
      const result = await this.execGit('remote get-url origin')
      return result.trim()
    } catch {
      return undefined
    }
  }

  private async execGit(command: string): Promise<string> {
    // Validate command to prevent injection - only allow alphanumeric, spaces, and safe git options
    if (!/^[a-zA-Z0-9\s\-\.\/_=]+$/.test(command)) {
      throw new Error('Invalid git command contains unsafe characters')
    }

    try {
      const result = execSync(`git ${command}`, {
        cwd: this.projectRoot,
        encoding: 'utf8',
        timeout: 10000,
        stdio: 'pipe'
      })
      return result
    } catch (error) {
      throw error
    }
  }

  private hasStateChanged(previous: GitContext, current: GitContext): boolean {
    return (
      previous.branch !== current.branch ||
      previous.status !== current.status ||
      previous.stagedFiles.length !== current.stagedFiles.length ||
      previous.modifiedFiles.length !== current.modifiedFiles.length ||
      previous.untrackedFiles.length !== current.untrackedFiles.length ||
      JSON.stringify(previous.stagedFiles) !== JSON.stringify(current.stagedFiles) ||
      JSON.stringify(previous.modifiedFiles) !== JSON.stringify(current.modifiedFiles) ||
      JSON.stringify(previous.untrackedFiles) !== JSON.stringify(current.untrackedFiles)
    )
  }

  getState(): GitContext {
    return { ...this.gitState }
  }

  onStateChange(callback: (gitState: GitContext) => void): void {
    this.eventEmitter.on('stateChange', callback)
  }

  dispose(): void {
    if (this.watchTimer) {
      clearInterval(this.watchTimer)
    }
    this.eventEmitter.removeAllListeners()
  }
}