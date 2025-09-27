// Context Store - Core IDE context management following Gemini CLI patterns
import { EventEmitter } from 'events'
import { readFile } from 'fs/promises'
import { relative } from 'path'
import type {
  IContextStore,
  IDEContext,
  ContextDelta,
  FileChange,
  GitContext,
  GitCommit,
  WorkspaceSettings,
  ContextRelevance,
  ContextCompression,
  LanguageServerInfo,
  Diagnostic,
  Symbol,
  DeepConfig
} from '../types/core-types.js'
import { GitManager } from './git-manager.js'
import { FileWatcher } from './file-watcher.js'
import { ContextAnalyzer } from './context-analyzer.js'
import { ContextCompressor } from './context-compressor.js'

/**
 * Core context store implementation managing IDE state
 * Based on Gemini CLI patterns but adapted for OpenAI Response API
 */
export class ContextStore implements IContextStore {
  private context: IDEContext
  private eventEmitter = new EventEmitter()
  private gitManager: GitManager
  private fileWatcher: FileWatcher
  private contextAnalyzer: ContextAnalyzer
  private contextCompressor: ContextCompressor
  private config: DeepConfig
  private updateDebounceTimer: NodeJS.Timeout | undefined
  private readonly debounceMs = 300 // Debounce context updates like Gemini CLI

  constructor(config: DeepConfig, projectRoot?: string) {
    this.config = config

    // Initialize context with defaults
    this.context = {
      openFiles: [],
      projectRoot: projectRoot || process.cwd(),
      gitState: {
        branch: 'unknown',
        status: 'unknown',
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
      tokenCount: 0
    }

    // Initialize managers
    this.gitManager = new GitManager(this.context.projectRoot)
    this.fileWatcher = new FileWatcher(this.context.projectRoot)
    this.contextAnalyzer = new ContextAnalyzer(config)
    this.contextCompressor = new ContextCompressor(config)

    this.setupEventHandlers()
  }

  private setupEventHandlers(): void {
    // Git state changes
    this.gitManager.onStateChange((gitState) => {
      this.handleGitStateChange(gitState)
    })

    // File system changes
    this.fileWatcher.onFileChange((change) => {
      this.handleFileChange(change)
    })

    // Auto-refresh context based on config
    if (this.config.context.refreshIntervalMs > 0) {
      setInterval(() => {
        this.refreshProjectStructure()
      }, this.config.context.refreshIntervalMs)
    }
  }

  private handleGitStateChange(gitState: GitContext): void {
    const delta: ContextDelta = {
      added: {},
      removed: [],
      modified: { gitState },
      timestamp: new Date(),
      tokenDelta: 0, // Will be calculated
      reason: 'git_state_change'
    }

    this.updateContextWithDelta(delta)
    this.eventEmitter.emit('gitStateChange', gitState)
  }

  private handleFileChange(change: FileChange): void {
    // Add to recent changes (keep last 100 changes)
    this.context.recentChanges.unshift(change)
    if (this.context.recentChanges.length > 100) {
      this.context.recentChanges = this.context.recentChanges.slice(0, 100)
    }

    const delta: ContextDelta = {
      added: {},
      removed: [],
      modified: { recentChanges: this.context.recentChanges },
      timestamp: new Date(),
      tokenDelta: 0,
      reason: `file_${change.changeType}`
    }

    this.updateContextWithDelta(delta)
    this.eventEmitter.emit('fileChange', change)
  }

  private updateContextWithDelta(delta: ContextDelta): void {
    // Apply delta to context
    Object.assign(this.context, delta.added, delta.modified)

    // Update token count
    const previousTokens = this.context.tokenCount
    this.context.tokenCount = this.estimateTokenCount()
    delta.tokenDelta = this.context.tokenCount - previousTokens

    // Update timestamp
    this.context.lastUpdate = delta.timestamp

    // Debounced event emission
    this.emitContextChangeDebounced(delta)
  }

  private emitContextChangeDebounced(delta: ContextDelta): void {
    if (this.updateDebounceTimer) {
      clearTimeout(this.updateDebounceTimer)
    }

    this.updateDebounceTimer = setTimeout(() => {
      this.eventEmitter.emit('contextChange', delta)
    }, this.debounceMs)
  }

  private estimateTokenCount(): number {
    // Simple token estimation (roughly 4 chars per token)
    let totalChars = 0

    // Count open files content (estimate)
    totalChars += this.context.openFiles.length * 1000 // Estimate 1000 chars per file

    // Count git state
    totalChars += JSON.stringify(this.context.gitState).length

    // Count recent changes
    totalChars += JSON.stringify(this.context.recentChanges).length

    // Count workspace settings
    totalChars += JSON.stringify(this.context.workspaceSettings).length

    return Math.ceil(totalChars / 4)
  }

  // IContextStore implementation
  async getCurrentContext(): Promise<IDEContext> {
    return { ...this.context }
  }

  async updateContext(delta: ContextDelta): Promise<void> {
    this.updateContextWithDelta(delta)
  }

  async setActiveFile(filePath: string): Promise<void> {
    const absolutePath = this.resolveFilePath(filePath)

    // Update existing files to mark as inactive
    this.context.openFiles.forEach(file => {
      file.isActive = false
    })

    // Find or add the active file
    let file = this.context.openFiles.find(f => f.path === absolutePath)
    if (!file) {
      file = {
        path: absolutePath,
        timestamp: Date.now(),
        isActive: true
      }
      this.context.openFiles.unshift(file)

      // Limit to max files (like Gemini CLI)
      if (this.context.openFiles.length > 10) {
        this.context.openFiles = this.context.openFiles.slice(0, 10)
      }
    } else {
      file.isActive = true
      file.timestamp = Date.now()

      // Move to front
      this.context.openFiles = [
        file,
        ...this.context.openFiles.filter(f => f.path !== absolutePath)
      ]
    }

    const delta: ContextDelta = {
      added: {},
      removed: [],
      modified: {
        activeFile: absolutePath,
        openFiles: this.context.openFiles
      },
      timestamp: new Date(),
      tokenDelta: 0,
      reason: 'active_file_change'
    }

    this.updateContextWithDelta(delta)
  }

  async setCursorPosition(line: number, character: number): Promise<void> {
    const cursorPosition = { line, character }

    // Update cursor position for active file
    const activeFile = this.context.openFiles.find(f => f.isActive)
    if (activeFile) {
      activeFile.cursor = cursorPosition
    }

    const delta: ContextDelta = {
      added: {},
      removed: [],
      modified: {
        cursorPosition,
        openFiles: this.context.openFiles
      },
      timestamp: new Date(),
      tokenDelta: 0,
      reason: 'cursor_position_change'
    }

    this.updateContextWithDelta(delta)
  }

  async setSelectedText(
    content: string,
    start: {line: number, character: number},
    end: {line: number, character: number}
  ): Promise<void> {
    // Limit selected text length like Gemini CLI
    const maxLength = 16384 // 16 KiB limit
    const truncatedContent = content.length > maxLength
      ? content.substring(0, maxLength)
      : content

    const selectedText = {
      content: truncatedContent,
      startLine: start.line,
      endLine: end.line,
      startColumn: start.character,
      endColumn: end.character
    }

    // Update selected text for active file
    const activeFile = this.context.openFiles.find(f => f.isActive)
    if (activeFile) {
      activeFile.selectedText = truncatedContent
    }

    const delta: ContextDelta = {
      added: {},
      removed: [],
      modified: {
        selectedText,
        openFiles: this.context.openFiles
      },
      timestamp: new Date(),
      tokenDelta: 0,
      reason: 'selection_change'
    }

    this.updateContextWithDelta(delta)
  }

  async addOpenFile(filePath: string): Promise<void> {
    const absolutePath = this.resolveFilePath(filePath)

    // Check if already open
    if (this.context.openFiles.some(f => f.path === absolutePath)) {
      return
    }

    const file = {
      path: absolutePath,
      timestamp: Date.now(),
      isActive: false
    }

    this.context.openFiles.unshift(file)

    // Limit to max files
    if (this.context.openFiles.length > 10) {
      this.context.openFiles = this.context.openFiles.slice(0, 10)
    }

    const delta: ContextDelta = {
      added: {},
      removed: [],
      modified: { openFiles: this.context.openFiles },
      timestamp: new Date(),
      tokenDelta: 0,
      reason: 'file_opened'
    }

    this.updateContextWithDelta(delta)
  }

  async removeOpenFile(filePath: string): Promise<void> {
    const absolutePath = this.resolveFilePath(filePath)

    this.context.openFiles = this.context.openFiles.filter(f => f.path !== absolutePath)

    const delta: ContextDelta = {
      added: {},
      removed: [],
      modified: { openFiles: this.context.openFiles },
      timestamp: new Date(),
      tokenDelta: 0,
      reason: 'file_closed'
    }

    this.updateContextWithDelta(delta)
  }

  async trackFileChange(change: FileChange): Promise<void> {
    this.handleFileChange(change)
  }

  async refreshProjectStructure(): Promise<void> {
    try {
      // Refresh git state
      await this.gitManager.refreshState()

      // Refresh workspace settings
      await this.refreshWorkspaceSettings()

      const delta: ContextDelta = {
        added: {},
        removed: [],
        modified: {},
        timestamp: new Date(),
        tokenDelta: 0,
        reason: 'project_refresh'
      }

      this.updateContextWithDelta(delta)
    } catch (error) {
      console.error('Failed to refresh project structure:', error)
    }
  }

  async updateGitState(): Promise<void> {
    await this.gitManager.refreshState()
  }

  async getGitHistory(limit = 10): Promise<GitCommit[]> {
    return this.gitManager.getHistory(limit)
  }

  async compressContext(strategy?: ContextCompression['strategy']): Promise<IDEContext> {
    return this.contextCompressor.compress(this.context, strategy)
  }

  async filterRelevantContext(threshold = 0.5): Promise<IDEContext> {
    return this.contextAnalyzer.filterRelevant(this.context, threshold)
  }

  async analyzeRelevance(filePaths: string[]): Promise<ContextRelevance[]> {
    return this.contextAnalyzer.analyzeRelevance(filePaths, this.context)
  }

  async syncWithLanguageServer(): Promise<void> {
    // TODO: Implement LSP integration
    console.log('LSP sync not implemented yet')
  }

  async refreshWorkspaceSettings(): Promise<void> {
    try {
      // Try to detect package.json for project type
      const packageJsonPath = `${this.context.projectRoot}/package.json`
      try {
        const packageContent = await readFile(packageJsonPath, 'utf-8')
        const packageJson = JSON.parse(packageContent)

        this.context.workspaceSettings = {
          ...this.context.workspaceSettings,
          packageManager: this.detectPackageManager(),
          projectType: this.detectProjectType(packageJson),
          testFramework: this.detectTestFramework(packageJson),
          buildCommand: packageJson.scripts?.build || undefined
        }
      } catch {
        // No package.json or parsing error, keep defaults
      }
    } catch (error) {
      console.error('Failed to refresh workspace settings:', error)
    }
  }

  // Event handling
  onContextChange(callback: (delta: ContextDelta) => void): void {
    this.eventEmitter.on('contextChange', callback)
  }

  onFileChange(callback: (change: FileChange) => void): void {
    this.eventEmitter.on('fileChange', callback)
  }

  onGitStateChange(callback: (gitState: GitContext) => void): void {
    this.eventEmitter.on('gitStateChange', callback)
  }

  // Helper methods
  private resolveFilePath(filePath: string): string {
    const path = require('path')

    // Handle absolute paths
    if (filePath.startsWith('/') || filePath.match(/^[A-Z]:/)) {
      const resolved = path.resolve(filePath)
      // Ensure absolute paths are within project root for security
      if (!resolved.startsWith(path.resolve(this.context.projectRoot))) {
        throw new Error(`Path ${filePath} is outside project root`)
      }
      return resolved
    }

    // Handle relative paths
    const resolved = path.resolve(this.context.projectRoot, filePath)

    // Validate that resolved path is within project bounds (prevent path traversal)
    if (!resolved.startsWith(path.resolve(this.context.projectRoot))) {
      throw new Error(`Path ${filePath} resolves outside project root`)
    }

    return resolved
  }

  private detectPackageManager(): 'npm' | 'yarn' | 'pnpm' | 'bun' {
    // Simple detection based on lock files
    // In a real implementation, check for lock file existence
    return 'npm'
  }

  private detectProjectType(packageJson: any): 'node' | 'react' | 'vue' | 'python' | 'rust' | 'go' | 'other' {
    if (packageJson.dependencies?.react || packageJson.devDependencies?.react) {
      return 'react'
    }
    if (packageJson.dependencies?.vue || packageJson.devDependencies?.vue) {
      return 'vue'
    }
    if (packageJson.dependencies?.['@types/node'] || packageJson.devDependencies?.['@types/node']) {
      return 'node'
    }
    // Check for Python project indicators
    if (packageJson.scripts?.['python'] || packageJson.dependencies?.['python']) {
      return 'python'
    }
    // Check for Rust project indicators (though unlikely in package.json)
    if (packageJson.dependencies?.['rust'] || packageJson.scripts?.['cargo']) {
      return 'rust'
    }
    // Check for Go project indicators
    if (packageJson.scripts?.['go'] || packageJson.dependencies?.['go']) {
      return 'go'
    }
    return 'other'
  }

  private detectTestFramework(packageJson: any): string | undefined {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies }
    if (deps.vitest) return 'vitest'
    if (deps.jest) return 'jest'
    if (deps.mocha) return 'mocha'
    return undefined
  }

  // Cleanup
  dispose(): void {
    if (this.updateDebounceTimer) {
      clearTimeout(this.updateDebounceTimer)
    }
    this.fileWatcher.dispose()
    this.eventEmitter.removeAllListeners()
  }
}