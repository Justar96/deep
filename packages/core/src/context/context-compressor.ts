// Context Compressor - Intelligent context compression for large codebases
import type {
  IDEContext,
  ContextCompression,
  DeepConfig,
  FileChange,
  GitCommit
} from '../types.js'

/**
 * Compresses IDE context to fit within token limits while preserving important information
 * Uses multiple strategies: summarize, filter, and truncate
 */
export class ContextCompressor {
  constructor(private readonly config: DeepConfig) {}

  async compress(
    context: IDEContext,
    strategy?: ContextCompression['strategy']
  ): Promise<IDEContext> {
    const compressionStrategy = strategy || this.config.context.compressionEnabled
      ? 'smart'
      : 'filter'

    switch (compressionStrategy) {
      case 'summarize':
        return this.summarizeContext(context)
      case 'filter':
        return this.filterContext(context)
      case 'truncate':
        return this.truncateContext(context)
      default:
        return this.smartCompress(context)
    }
  }

  private async smartCompress(context: IDEContext): Promise<IDEContext> {
    // Smart compression uses all strategies based on content size and importance
    const currentTokens = this.estimateTokenCount(context)
    const maxTokens = this.config.context.maxContextSize || 8000

    if (currentTokens <= maxTokens) {
      return context // No compression needed
    }

    // First try filtering
    let compressed = await this.filterContext(context)
    let compressedTokens = this.estimateTokenCount(compressed)

    if (compressedTokens <= maxTokens) {
      return compressed
    }

    // Then try summarization
    compressed = await this.summarizeContext(compressed)
    compressedTokens = this.estimateTokenCount(compressed)

    if (compressedTokens <= maxTokens) {
      return compressed
    }

    // Finally truncate if still too large
    return this.truncateContext(compressed)
  }

  private async filterContext(context: IDEContext): Promise<IDEContext> {
    // Filter based on relevance and recency
    const relevanceThreshold = this.config.context.relevanceThreshold || 0.3

    // Keep only the most relevant open files
    const sortedFiles = [...context.openFiles].sort((a, b) => {
      if (a.isActive) return -1
      if (b.isActive) return 1
      return b.timestamp - a.timestamp
    })

    const maxFiles = 5 // Limit to top 5 files
    const filteredOpenFiles = sortedFiles.slice(0, maxFiles)

    // Keep only recent changes (last 24 hours)
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000)
    const filteredRecentChanges = context.recentChanges
      .filter(change => change.timestamp.getTime() > oneDayAgo)
      .slice(0, 20) // Limit to 20 most recent changes

    // Keep only recent commits (last 5)
    const filteredCommits = context.gitState.recentCommits.slice(0, 5)

    return {
      ...context,
      openFiles: filteredOpenFiles,
      recentChanges: filteredRecentChanges,
      gitState: {
        ...context.gitState,
        recentCommits: filteredCommits
      }
    }
  }

  private async summarizeContext(context: IDEContext): Promise<IDEContext> {
    // Create summarized versions of complex data structures
    const summarizedOpenFiles = context.openFiles.map(file => ({
      ...file,
      selectedText: file.selectedText
        ? this.summarizeText(file.selectedText, 200)
        : undefined
    }))

    const summarizedRecentChanges = this.summarizeRecentChanges(context.recentChanges)
    const summarizedCommits = this.summarizeCommits(context.gitState.recentCommits)

    return {
      ...context,
      openFiles: summarizedOpenFiles,
      recentChanges: summarizedRecentChanges,
      gitState: {
        ...context.gitState,
        recentCommits: summarizedCommits
      }
    }
  }

  private truncateContext(context: IDEContext): Promise<IDEContext> {
    // Aggressive truncation to fit within limits
    const truncated: IDEContext = {
      ...context,
      openFiles: context.openFiles.slice(0, 3), // Keep only top 3 files
      recentChanges: context.recentChanges.slice(0, 10), // Keep only 10 recent changes
      gitState: {
        ...context.gitState,
        recentCommits: context.gitState.recentCommits.slice(0, 3), // Keep only 3 commits
        modifiedFiles: context.gitState.modifiedFiles.slice(0, 5),
        stagedFiles: context.gitState.stagedFiles.slice(0, 5),
        untrackedFiles: context.gitState.untrackedFiles.slice(0, 5)
      }
    }

    // Truncate selected text
    truncated.openFiles = truncated.openFiles.map(file => ({
      ...file,
      selectedText: file.selectedText
        ? this.truncateText(file.selectedText, 100)
        : undefined
    }))

    return Promise.resolve(truncated)
  }

  private summarizeRecentChanges(changes: FileChange[]): FileChange[] {
    // Group changes by file and keep only the most recent change per file
    const changeMap = new Map<string, FileChange>()

    for (const change of changes) {
      const existing = changeMap.get(change.filePath)
      if (!existing || change.timestamp > existing.timestamp) {
        changeMap.set(change.filePath, change)
      }
    }

    return Array.from(changeMap.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 15) // Keep top 15
  }

  private summarizeCommits(commits: GitCommit[]): GitCommit[] {
    // Keep commits with summarized messages and limited file lists
    return commits.map(commit => ({
      ...commit,
      message: this.summarizeText(commit.message, 100),
      filesChanged: commit.filesChanged.slice(0, 5) // Limit files per commit
    })).slice(0, 5) // Keep only 5 commits
  }

  private summarizeText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text
    }

    // Simple truncation with ellipsis
    // In a full implementation, this could use AI summarization
    return text.substring(0, maxLength - 3) + '...'
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text
    }

    return text.substring(0, maxLength - 3) + '...'
  }

  private estimateTokenCount(context: IDEContext): number {
    // Rough token estimation (4 characters per token on average)
    let totalChars = 0

    // Open files
    totalChars += JSON.stringify(context.openFiles).length

    // Git state
    totalChars += JSON.stringify(context.gitState).length

    // Recent changes
    totalChars += JSON.stringify(context.recentChanges).length

    // Workspace settings
    totalChars += JSON.stringify(context.workspaceSettings).length

    // Language server info
    if (context.languageServerInfo) {
      totalChars += JSON.stringify(context.languageServerInfo).length
    }

    return Math.ceil(totalChars / 4)
  }

  // Advanced compression methods
  async compressWithAI(context: IDEContext): Promise<IDEContext> {
    // TODO: Implement AI-powered compression using OpenAI API
    // This would use the conversation compression patterns from Sprint 1
    // to intelligently summarize context while preserving important details

    console.log('AI-powered compression not implemented yet')
    return this.smartCompress(context)
  }

  async preserveActiveFileContext(context: IDEContext): Promise<IDEContext> {
    // Ensure active file context is always preserved during compression
    const activeFile = context.openFiles.find(f => f.isActive)

    if (!activeFile) {
      return context
    }

    // Always include the active file in compressed context
    const compressed = await this.compress(context)

    // Ensure active file is still present and detailed
    const hasActiveFile = compressed.openFiles.some(f => f.path === activeFile.path)

    if (!hasActiveFile) {
      compressed.openFiles.unshift(activeFile)
    }

    return compressed
  }

  getCompressionStats(original: IDEContext, compressed: IDEContext): {
    originalTokens: number
    compressedTokens: number
    compressionRatio: number
    filesRemoved: number
    changesRemoved: number
  } {
    const originalTokens = this.estimateTokenCount(original)
    const compressedTokens = this.estimateTokenCount(compressed)

    return {
      originalTokens,
      compressedTokens,
      compressionRatio: compressedTokens / originalTokens,
      filesRemoved: original.openFiles.length - compressed.openFiles.length,
      changesRemoved: original.recentChanges.length - compressed.recentChanges.length
    }
  }
}