// Context Analyzer - Relevance analysis and intelligent filtering
import { relative, extname, basename, dirname } from 'path'
import type {
  IDEContext,
  ContextRelevance,
  DeepConfig,
  FileChange
} from '../types/core-types.js'

/**
 * Analyzes context relevance and performs intelligent filtering
 * Based on file relationships, recent activity, and conversation context
 */
export class ContextAnalyzer {
  constructor(private readonly config: DeepConfig) {}

  async analyzeRelevance(
    filePaths: string[],
    context: IDEContext
  ): Promise<ContextRelevance[]> {
    const results: ContextRelevance[] = []

    for (const filePath of filePaths) {
      const relevance = await this.calculateFileRelevance(filePath, context)
      results.push(relevance)
    }

    // Sort by relevance score descending
    return results.sort((a, b) => b.relevanceScore - a.relevanceScore)
  }

  async filterRelevant(
    context: IDEContext,
    threshold: number = 0.5
  ): Promise<IDEContext> {
    // Analyze relevance of all open files
    const openFilePaths = context.openFiles.map(f => f.path)
    const relevanceAnalysis = await this.analyzeRelevance(openFilePaths, context)

    // Filter files above threshold
    const relevantFiles = relevanceAnalysis
      .filter(r => r.relevanceScore >= threshold)
      .map(r => r.filePath)

    // Filter open files to only include relevant ones
    const filteredOpenFiles = context.openFiles.filter(file =>
      relevantFiles.includes(file.path)
    )

    // Filter recent changes to only include relevant ones
    const filteredRecentChanges = context.recentChanges.filter(change =>
      this.isChangeRelevant(change, context, threshold)
    )

    return {
      ...context,
      openFiles: filteredOpenFiles,
      recentChanges: filteredRecentChanges
    }
  }

  private async calculateFileRelevance(
    filePath: string,
    context: IDEContext
  ): Promise<ContextRelevance> {
    const factors = {
      recentlyModified: false,
      currentlyOpen: false,
      relatedToActiveFile: false,
      containsErrors: false,
      referencedInConversation: false
    }

    let score = 0.1 // Base score

    // Check if currently open
    factors.currentlyOpen = context.openFiles.some(f => f.path === filePath)
    if (factors.currentlyOpen) {
      score += 0.3

      // Extra boost for active file
      const isActive = context.openFiles.find(f => f.path === filePath)?.isActive
      if (isActive) {
        score += 0.4
      }
    }

    // Check if recently modified
    const recentChange = context.recentChanges.find(c => c.filePath === filePath)
    factors.recentlyModified = !!recentChange && this.isRecentChange(recentChange)
    if (factors.recentlyModified) {
      score += 0.2

      // Extra boost for very recent changes (last 5 minutes)
      if (recentChange && this.isVeryRecentChange(recentChange)) {
        score += 0.1
      }
    }

    // Check relationship to active file
    const activeFile = context.openFiles.find(f => f.isActive)
    if (activeFile) {
      factors.relatedToActiveFile = this.areFilesRelated(filePath, activeFile.path)
      if (factors.relatedToActiveFile) {
        score += 0.15
      }
    }

    // File type scoring
    score += this.getFileTypeScore(filePath)

    // Directory structure scoring
    score += this.getDirectoryScore(filePath, context.projectRoot)

    // Git status scoring
    score += this.getGitStatusScore(filePath, context)

    // Cap score at 1.0
    const relevanceScore = Math.min(1.0, score)

    return {
      filePath,
      relevanceScore,
      factors,
      lastAccessed: this.getLastAccessTime(filePath, context)
    }
  }

  private isChangeRelevant(
    change: FileChange,
    context: IDEContext,
    threshold: number
  ): boolean {
    // Use the change's relevance score if available
    if (change.relevanceScore !== undefined) {
      return change.relevanceScore >= threshold
    }

    // Fallback to basic heuristics
    return this.isRecentChange(change) ||
           context.openFiles.some(f => f.path === change.filePath)
  }

  private isRecentChange(change: FileChange): boolean {
    const minutesAgo = (Date.now() - change.timestamp.getTime()) / (1000 * 60)
    return minutesAgo < 30 // Consider changes in last 30 minutes as recent
  }

  private isVeryRecentChange(change: FileChange): boolean {
    const minutesAgo = (Date.now() - change.timestamp.getTime()) / (1000 * 60)
    return minutesAgo < 5 // Very recent: last 5 minutes
  }

  private areFilesRelated(filePath1: string, filePath2: string): boolean {
    // Same directory
    if (dirname(filePath1) === dirname(filePath2)) {
      return true
    }

    // Similar names (e.g., component.ts and component.test.ts)
    const name1 = basename(filePath1, extname(filePath1))
    const name2 = basename(filePath2, extname(filePath2))

    if (name1.includes(name2) || name2.includes(name1)) {
      return true
    }

    // Test file relationships
    if (this.isTestFileRelated(filePath1, filePath2)) {
      return true
    }

    return false
  }

  private isTestFileRelated(filePath1: string, filePath2: string): boolean {
    const isTest1 = this.isTestFile(filePath1)
    const isTest2 = this.isTestFile(filePath2)

    // One is test, one is not
    if (isTest1 !== isTest2) {
      const testFile = isTest1 ? filePath1 : filePath2
      const sourceFile = isTest1 ? filePath2 : filePath1

      const testName = basename(testFile, extname(testFile))
        .replace(/\.(test|spec)$/, '')
      const sourceName = basename(sourceFile, extname(sourceFile))

      return testName === sourceName
    }

    return false
  }

  private isTestFile(filePath: string): boolean {
    const fileName = basename(filePath)
    return /\.(test|spec)\.(ts|js|tsx|jsx)$/.test(fileName) ||
           fileName.includes('__tests__')
  }

  private getFileTypeScore(filePath: string): number {
    const ext = extname(filePath).toLowerCase()

    // Source code files get highest score
    if (['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.cpp', '.c', '.h'].includes(ext)) {
      return 0.2
    }

    // Configuration and important files
    if (['.json', '.yaml', '.yml', '.toml', '.xml', '.env'].includes(ext)) {
      return 0.1
    }

    // Documentation
    if (['.md', '.txt', '.rst'].includes(ext)) {
      return 0.05
    }

    // Lower priority for other files
    return 0.0
  }

  private getDirectoryScore(filePath: string, projectRoot: string): number {
    const relativePath = relative(projectRoot, filePath)
    const pathParts = relativePath.split('/')

    let score = 0

    // Penalty for deep nesting
    if (pathParts.length > 5) {
      score -= 0.05
    }

    // Boost for important directories
    if (pathParts.includes('src')) {
      score += 0.05
    }

    if (pathParts.includes('lib') || pathParts.includes('components')) {
      score += 0.03
    }

    // Penalty for certain directories
    if (pathParts.includes('node_modules') ||
        pathParts.includes('dist') ||
        pathParts.includes('build')) {
      score -= 0.2
    }

    return score
  }

  private getGitStatusScore(filePath: string, context: IDEContext): number {
    const relativePath = relative(context.projectRoot, filePath)
    let score = 0

    // Boost for modified files
    if (context.gitState.modifiedFiles.includes(relativePath)) {
      score += 0.1
    }

    // Boost for staged files
    if (context.gitState.stagedFiles.includes(relativePath)) {
      score += 0.05
    }

    // Small boost for untracked files
    if (context.gitState.untrackedFiles.includes(relativePath)) {
      score += 0.02
    }

    return score
  }

  private getLastAccessTime(filePath: string, context: IDEContext): Date {
    const openFile = context.openFiles.find(f => f.path === filePath)
    if (openFile) {
      return new Date(openFile.timestamp)
    }

    const recentChange = context.recentChanges
      .filter(c => c.filePath === filePath)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]

    if (recentChange) {
      return recentChange.timestamp
    }

    // Default to epoch if no access time found
    return new Date(0)
  }

  // Advanced analysis methods
  async analyzeCodeRelationships(filePaths: string[]): Promise<Map<string, string[]>> {
    // TODO: Implement AST-based code relationship analysis
    // This would parse import/export statements to find actual code dependencies
    const relationships = new Map<string, string[]>()

    for (const filePath of filePaths) {
      relationships.set(filePath, [])
    }

    return relationships
  }

  async analyzeConversationReferences(
    filePaths: string[],
    conversationContext: string
  ): Promise<Map<string, number>> {
    // TODO: Implement conversation-based relevance analysis
    // This would analyze the conversation text to find file/function references
    const references = new Map<string, number>()

    for (const filePath of filePaths) {
      const fileName = basename(filePath)
      // Simple heuristic: count mentions of filename in conversation
      const mentions = (conversationContext.match(new RegExp(fileName, 'gi')) || []).length
      references.set(filePath, mentions)
    }

    return references
  }
}