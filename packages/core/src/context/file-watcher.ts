// File Watcher - File system change tracking
import { EventEmitter } from 'events'
import { watch, FSWatcher, Stats } from 'fs'
import { stat } from 'fs/promises'
import { join, relative } from 'path'
import type { FileChange } from '../types/core-types.js'

/**
 * Watches file system changes in the project directory
 * Provides real-time notifications for file creation, modification, deletion
 */
export class FileWatcher {
  private eventEmitter = new EventEmitter()
  private watchers: Map<string, FSWatcher> = new Map()
  private fileStates: Map<string, Stats> = new Map()
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map()
  private readonly debounceMs = 100 // Debounce rapid file changes

  constructor(private readonly projectRoot: string) {
    this.startWatching()
  }

  private startWatching(): void {
    try {
      // Watch the project root recursively
      const watcher = watch(
        this.projectRoot,
        { recursive: true },
        (eventType, filename) => {
          if (filename) {
            this.handleFileEvent(eventType, filename)
          }
        }
      )

      this.watchers.set(this.projectRoot, watcher)

      watcher.on('error', (error) => {
        console.error('File watcher error:', error)
      })
    } catch (error) {
      console.error('Failed to start file watching:', error)
    }
  }

  private handleFileEvent(eventType: string, filename: string): void {
    const filePath = join(this.projectRoot, filename)
    const relativePath = relative(this.projectRoot, filePath)

    // Skip certain files/directories
    if (this.shouldIgnoreFile(relativePath)) {
      return
    }

    // Debounce rapid changes to the same file
    const existingTimer = this.debounceTimers.get(filePath)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    const timer = setTimeout(() => {
      this.processFileChange(eventType, filePath, relativePath)
      this.debounceTimers.delete(filePath)
    }, this.debounceMs)

    this.debounceTimers.set(filePath, timer)
  }

  private async processFileChange(
    eventType: string,
    filePath: string,
    relativePath: string
  ): Promise<void> {
    try {
      const change = await this.determineChangeType(filePath, relativePath)
      if (change) {
        this.eventEmitter.emit('fileChange', change)
      }
    } catch (error) {
      console.error(`Failed to process file change for ${filePath}:`, error)
    }
  }

  private async determineChangeType(
    filePath: string,
    relativePath: string
  ): Promise<FileChange | null> {
    try {
      const currentStats = await stat(filePath)
      const previousStats = this.fileStates.get(filePath)

      let changeType: FileChange['changeType']

      if (!previousStats) {
        // New file
        changeType = 'created'
      } else {
        // Modified file
        changeType = 'modified'
      }

      // Update file state
      this.fileStates.set(filePath, currentStats)

      return {
        filePath: relativePath,
        changeType,
        timestamp: new Date(),
        lineChanges: await this.calculateLineChanges(filePath, changeType),
        relevanceScore: this.calculateRelevanceScore(relativePath, changeType)
      }
    } catch (error) {
      // File was deleted or is inaccessible
      const previousStats = this.fileStates.get(filePath)
      if (previousStats) {
        this.fileStates.delete(filePath)

        return {
          filePath: relativePath,
          changeType: 'deleted',
          timestamp: new Date(),
          relevanceScore: this.calculateRelevanceScore(relativePath, 'deleted')
        }
      }

      return null
    }
  }

  private async calculateLineChanges(
    filePath: string,
    changeType: FileChange['changeType']
  ): Promise<{ added: number; removed: number; modified: number } | undefined> {
    if (changeType === 'deleted') {
      return undefined
    }

    // For now, return undefined. In a full implementation, this would:
    // 1. Compare with previous version of the file
    // 2. Use git diff or similar to calculate line changes
    // 3. Return actual line count differences
    return undefined
  }

  private calculateRelevanceScore(
    relativePath: string,
    changeType: FileChange['changeType']
  ): number {
    let score = 0.5 // Base score

    // Higher relevance for certain file types
    if (relativePath.match(/\.(ts|js|tsx|jsx|py|java|cpp|c|h)$/)) {
      score += 0.3 // Source code files
    }

    if (relativePath.match(/\.(json|yaml|yml|toml|xml)$/)) {
      score += 0.2 // Configuration files
    }

    if (relativePath.match(/\.(md|txt|rst)$/)) {
      score += 0.1 // Documentation files
    }

    // Lower relevance for generated/temporary files
    if (relativePath.includes('node_modules') ||
        relativePath.includes('.git') ||
        relativePath.includes('dist') ||
        relativePath.includes('build') ||
        relativePath.includes('.cache')) {
      score -= 0.4
    }

    // Higher relevance for recently created files
    if (changeType === 'created') {
      score += 0.2
    }

    // Lower relevance for deleted files
    if (changeType === 'deleted') {
      score -= 0.1
    }

    return Math.max(0, Math.min(1, score))
  }

  private shouldIgnoreFile(relativePath: string): boolean {
    // Common patterns to ignore
    const ignorePatterns = [
      /node_modules/,
      /\.git\//,
      /\.cache/,
      /\.next/,
      /\.nuxt/,
      /dist\//,
      /build\//,
      /coverage\//,
      /\.nyc_output/,
      /\.vscode\/settings\.json$/,
      /\.DS_Store$/,
      /Thumbs\.db$/,
      /\.tmp$/,
      /\.temp$/,
      /\.swp$/,
      /\.swo$/,
      /~$/
    ]

    return ignorePatterns.some(pattern => pattern.test(relativePath))
  }

  // Public interface
  onFileChange(callback: (change: FileChange) => void): void {
    this.eventEmitter.on('fileChange', callback)
  }

  addWatchPath(path: string): void {
    try {
      if (!this.watchers.has(path)) {
        const watcher = watch(path, { recursive: true }, (eventType, filename) => {
          if (filename) {
            this.handleFileEvent(eventType, filename)
          }
        })

        this.watchers.set(path, watcher)

        watcher.on('error', (error) => {
          console.error(`File watcher error for ${path}:`, error)
        })
      }
    } catch (error) {
      console.error(`Failed to watch path ${path}:`, error)
    }
  }

  removeWatchPath(path: string): void {
    const watcher = this.watchers.get(path)
    if (watcher) {
      watcher.close()
      this.watchers.delete(path)
    }
  }

  dispose(): void {
    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer)
    }
    this.debounceTimers.clear()

    // Close all watchers
    for (const watcher of this.watchers.values()) {
      watcher.close()
    }
    this.watchers.clear()

    // Clear file states
    this.fileStates.clear()

    // Remove all listeners
    this.eventEmitter.removeAllListeners()
  }
}