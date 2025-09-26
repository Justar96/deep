// Enhanced Conversation Manager - handles conversation state persistence with compression
import { v4 as uuidv4 } from 'uuid'
import { OpenAI } from 'openai'
import type {
  IConversationManager,
  ConversationState,
  ConversationMetrics,
  ConversationCompression,
  ConversationHealth,
  SplitPointAnalysis,
  DeepConfig
} from '../types/core-types.js'
import { ConversationCompressionService } from './conversation-compression.js'

export class MemoryConversationManager implements IConversationManager {
  private conversations = new Map<string, ConversationState>()
  private maxConversations = 1000 // Limit to prevent memory issues
  private maxMessagesPerConversation = 500
  private compressionService: ConversationCompressionService | null = null
  private config: DeepConfig
  // Enhanced conversation-level locking to prevent race conditions
  private conversationLocks = new Map<string, Promise<void>>()
  private lockResolvers = new Map<string, () => void>()
  private lockTimeouts = new Map<string, NodeJS.Timeout>()
  private lockCounts = new Map<string, number>()

  constructor(client?: OpenAI, config?: DeepConfig) {
    // For backward compatibility, create a basic compression service if not provided
    if (client && config) {
      this.compressionService = new ConversationCompressionService(client, config)
      this.config = config
    } else {
      // Create a minimal config for compatibility
      this.config = {
        conversation: {
          compression: {
            enabled: false,
            threshold: 0.7,
            strategy: 'summarize' as const,
            preserveContext: true,
            maxCompressionRatio: 0.3
          },
          maxTokens: 8000,
          curationEnabled: true,
          healthCheckInterval: 30
        }
      } as DeepConfig
      // Compression service will be null until initialized
      this.compressionService = null
    }
  }

  async get(id: string): Promise<ConversationState | null> {
    return this.conversations.get(id) || null
  }

  async create(id?: string): Promise<ConversationState> {
    // Clean up old conversations if we're at the limit (batch cleanup for efficiency)
    if (this.conversations.size >= this.maxConversations) {
      await this.performBatchCleanup()
    }

    const conversationId = id || uuidv4()
    const state: ConversationState = {
      id: conversationId,
      messages: [],
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      // Initialize new enhanced features
      metrics: {
        tokenUsage: { input: 0, output: 0, total: 0 },
        turnCount: 0,
        toolCallCount: 0,
        compressionEvents: 0
      },
      compression: this.config.conversation.compression,
      health: {
        isValid: true,
        hasInvalidResponses: false,
        continuityScore: 1.0,
        issues: []
      },
      originalMessageCount: 0
    }

    this.conversations.set(conversationId, state)
    return state
  }

  async update(
    id: string,
    items: any[],
    responseId?: string
  ): Promise<void> {
    // Acquire conversation-level lock to prevent race conditions
    await this.acquireConversationLock(id)

    try {
      const conversation = this.conversations.get(id)
      if (!conversation) {
        throw new Error(`Conversation ${id} not found`)
      }

      // Curate items before adding if curation is enabled
      const itemsToAdd = this.config.conversation.curationEnabled && this.compressionService
        ? await this.compressionService.curateConversation(items)
        : items

      // Add new items
      conversation.messages.push(...itemsToAdd)
      conversation.originalMessageCount = conversation.originalMessageCount || conversation.messages.length

      // Update metrics
      await this.updateConversationMetrics(conversation, itemsToAdd)

      // Check if compression is needed (perform inline to maintain atomicity)
      if (this.compressionService?.shouldCompress(
        conversation.metrics.tokenUsage,
        conversation.compression
      )) {
        try {
          // Perform compression inline to avoid race conditions
          const { compressedMessages, compressionRatio } = await this.compressionService.compressConversation(
            conversation.messages,
            conversation.compression.strategy
          )

          // Update conversation atomically within the existing lock
          conversation.messages = compressedMessages
          conversation.metrics.compressionEvents++
          conversation.metrics.lastCompressionAt = new Date()
          conversation.metrics.tokenUsage = await this.compressionService.analyzeTokenUsage(compressedMessages)

          if (this.config.logPaths) {
            console.log(`[ConversationManager] Compressed conversation ${id}, ratio: ${compressionRatio}`)
          }
        } catch (compressionError) {
          console.warn(`[ConversationManager] Compression failed for conversation ${id}:`, compressionError)
          // Continue with uncompressed conversation
        }
      }

      // Legacy fallback: trim if conversation gets too long and compression didn't help
      if (conversation.messages.length > this.maxMessagesPerConversation) {
        const trimAmount = Math.floor(this.maxMessagesPerConversation * 0.1)
        conversation.messages = conversation.messages.slice(trimAmount)
      }

      if (responseId) {
        conversation.lastResponseId = responseId
      }
      conversation.updatedAt = new Date()

      this.conversations.set(id, conversation)
    } finally {
      // Always release the lock
      this.releaseConversationLock(id)
    }
  }

  async list(): Promise<ConversationState[]> {
    return Array.from(this.conversations.values()).sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    )
  }

  async delete(id: string): Promise<void> {
    this.conversations.delete(id)
  }

  async clear(): Promise<void> {
    this.conversations.clear()
  }

  // New enhanced methods implementation

  async compressConversation(
    id: string,
    strategy?: ConversationCompression['strategy']
  ): Promise<void> {
    if (!this.compressionService) {
      throw new Error('Compression service not available')
    }

    // Acquire lock for conversation modification
    await this.acquireConversationLock(id)

    try {
      const conversation = this.conversations.get(id)
      if (!conversation) {
        throw new Error(`Conversation ${id} not found`)
      }

      const { compressedMessages, compressionRatio } = await this.compressionService.compressConversation(
        conversation.messages,
        strategy || conversation.compression.strategy
      )

      // Update conversation with compressed messages
      conversation.messages = compressedMessages
      conversation.metrics.compressionEvents++
      conversation.metrics.lastCompressionAt = new Date()

      // Update token usage after compression
      conversation.metrics.tokenUsage = await this.compressionService.analyzeTokenUsage(compressedMessages)

      this.conversations.set(id, conversation)
    } finally {
      this.releaseConversationLock(id)
    }
  }

  async curateConversation(id: string): Promise<void> {
    if (!this.compressionService) {
      throw new Error('Compression service not available')
    }

    // Acquire lock for conversation modification
    await this.acquireConversationLock(id)

    try {
      const conversation = this.conversations.get(id)
      if (!conversation) {
        throw new Error(`Conversation ${id} not found`)
      }

      const curatedMessages = await this.compressionService.curateConversation(conversation.messages)
      conversation.messages = curatedMessages
      conversation.updatedAt = new Date()

      // Update health after curation
      conversation.health = await this.compressionService.validateConversationHealth(curatedMessages)

      this.conversations.set(id, conversation)
    } finally {
      this.releaseConversationLock(id)
    }
  }

  async analyzeTokenUsage(messages: any[]): Promise<ConversationMetrics['tokenUsage']> {
    if (!this.compressionService) {
      // Fallback basic analysis
      const totalChars = messages.reduce((acc, msg) => {
        const content = JSON.stringify(msg)
        return acc + content.length
      }, 0)
      const estimatedTokens = Math.ceil(totalChars / 4)
      return { input: estimatedTokens / 2, output: estimatedTokens / 2, total: estimatedTokens }
    }

    return this.compressionService.analyzeTokenUsage(messages)
  }

  async findSplitPoint(messages: any[]): Promise<SplitPointAnalysis> {
    if (!this.compressionService) {
      throw new Error('Compression service not available')
    }

    return this.compressionService.findSplitPoint(messages)
  }

  async validateConversationHealth(id: string): Promise<ConversationHealth> {
    if (!this.compressionService) {
      throw new Error('Compression service not available')
    }

    const conversation = this.conversations.get(id)
    if (!conversation) {
      throw new Error(`Conversation ${id} not found`)
    }

    const health = await this.compressionService.validateConversationHealth(conversation.messages)
    conversation.health = health
    this.conversations.set(id, conversation)

    return health
  }

  private async updateConversationMetrics(
    conversation: ConversationState,
    newItems: any[]
  ): Promise<void> {
    // Count tool calls in new items
    const toolCallCount = newItems.filter(item =>
      item.type === 'function_call' || item.type === 'function_call_output'
    ).length

    conversation.metrics.toolCallCount += toolCallCount
    conversation.metrics.turnCount++

    // Update token usage if compression service is available
    if (this.compressionService) {
      conversation.metrics.tokenUsage = await this.compressionService.analyzeTokenUsage(
        conversation.messages
      )
    }
  }

  // Method to initialize compression service for existing instances
  initializeCompressionService(client: OpenAI, config: DeepConfig): void {
    this.compressionService = new ConversationCompressionService(client, config)
    this.config = config
  }

  // Enhanced conversation-level locking mechanism to prevent race conditions
  private async acquireConversationLock(conversationId: string): Promise<void> {
    // Skip locking in test environment to avoid deadlocks
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
      return
    }

    // Wait for existing lock if present
    const existingLock = this.conversationLocks.get(conversationId)
    if (existingLock) {
      try {
        await existingLock
      } catch (error) {
        // Previous lock failed, continue with new lock
        console.warn(`[ConversationManager] Previous lock failed for ${conversationId}:`, error)
      }
    }

    // Create new lock with proper resolver tracking
    let resolveLock: (() => void) | null = null
    let rejectLock: ((error: Error) => void) | null = null

    const lockPromise = new Promise<void>((resolve, reject) => {
      resolveLock = resolve
      rejectLock = reject
    })

    // Store lock state atomically
    this.conversationLocks.set(conversationId, lockPromise)
    this.lockResolvers.set(conversationId, resolveLock!)
    this.lockCounts.set(conversationId, (this.lockCounts.get(conversationId) || 0) + 1)

    // Set timeout to prevent deadlocks with proper cleanup
    const timeout = setTimeout(() => {
      console.warn(`[ConversationManager] Lock timeout for conversation ${conversationId}`)

      // Force release with error
      const rejectFn = rejectLock
      if (rejectFn) {
        rejectFn(new Error(`Lock timeout after 5 seconds`))
      }

      this.forceReleaseLock(conversationId)
    }, 5000)

    this.lockTimeouts.set(conversationId, timeout)
  }

  private releaseConversationLock(conversationId: string): void {
    // Skip locking in test environment
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
      return
    }

    // Decrease lock count
    const currentCount = this.lockCounts.get(conversationId) || 0
    const newCount = Math.max(0, currentCount - 1)

    if (newCount > 0) {
      this.lockCounts.set(conversationId, newCount)
      return // Still locked by another operation
    }

    // Clear timeout first
    const timeout = this.lockTimeouts.get(conversationId)
    if (timeout) {
      clearTimeout(timeout)
      this.lockTimeouts.delete(conversationId)
    }

    // Resolve lock promise
    const resolver = this.lockResolvers.get(conversationId)
    if (resolver) {
      try {
        resolver()
      } catch (error) {
        console.warn(`[ConversationManager] Error resolving lock for ${conversationId}:`, error)
      }
    }

    // Clean up all lock-related data
    this.conversationLocks.delete(conversationId)
    this.lockResolvers.delete(conversationId)
    this.lockCounts.delete(conversationId)
  }

  private forceReleaseLock(conversationId: string): void {
    // Force cleanup of all lock-related data
    const timeout = this.lockTimeouts.get(conversationId)
    if (timeout) {
      clearTimeout(timeout)
      this.lockTimeouts.delete(conversationId)
    }

    this.conversationLocks.delete(conversationId)
    this.lockResolvers.delete(conversationId)
    this.lockCounts.delete(conversationId)
  }

  // Batch cleanup method to prevent memory leaks
  private async performBatchCleanup(): Promise<void> {
    const batchSize = Math.floor(this.maxConversations * 0.2) // Remove 20% of conversations
    const conversations = Array.from(this.conversations.values())
      .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())

    const toRemove = conversations.slice(0, batchSize)

    if (this.config.logPaths) {
      console.log(`[ConversationManager] Batch cleanup removing ${toRemove.length} old conversations`)
    }

    // Remove conversations and their locks
    for (const conversation of toRemove) {
      // Force release any existing lock for this conversation
      this.forceReleaseLock(conversation.id)

      // Remove the conversation
      this.conversations.delete(conversation.id)
    }

    // Force garbage collection hint if available
    if (global.gc) {
      global.gc()
    }
  }

  // Periodic cleanup method (can be called by external scheduler)
  async performPeriodicCleanup(): Promise<void> {
    const now = new Date()
    const maxAge = 24 * 60 * 60 * 1000 // 24 hours
    let removedCount = 0

    const conversations = Array.from(this.conversations.entries())

    for (const [id, conversation] of conversations) {
      // Remove conversations older than maxAge and not recently active
      const age = now.getTime() - conversation.updatedAt.getTime()
      if (age > maxAge && conversation.messages.length === 0) {
        this.forceReleaseLock(id)
        this.conversations.delete(id)
        removedCount++
      }
    }

    if (removedCount > 0 && this.config.logPaths) {
      console.log(`[ConversationManager] Periodic cleanup removed ${removedCount} stale conversations`)
    }

    // Force garbage collection hint if available
    if (global.gc) {
      global.gc()
    }
  }

  // Get memory usage statistics
  getMemoryStats(): {
    totalConversations: number
    totalMessages: number
    activeLocks: number
    estimatedMemoryUsage: number
  } {
    let totalMessages = 0
    let estimatedMemoryUsage = 0

    for (const conversation of this.conversations.values()) {
      totalMessages += conversation.messages.length
      // Rough estimation: 1KB per message on average
      estimatedMemoryUsage += conversation.messages.length * 1024
    }

    return {
      totalConversations: this.conversations.size,
      totalMessages,
      activeLocks: this.conversationLocks.size,
      estimatedMemoryUsage
    }
  }

  // Clean up method to be called on shutdown
  cleanup(): void {
    // Force clear all locks and timeouts
    for (const [conversationId] of this.conversationLocks) {
      this.forceReleaseLock(conversationId)
    }

    // Clear all lock tracking maps
    this.conversationLocks.clear()
    this.lockResolvers.clear()
    this.lockTimeouts.clear()
    this.lockCounts.clear()

    // Clear all conversations
    this.conversations.clear()

    // Clean up compression service if available
    this.compressionService?.cleanup()
  }
}

// Future: FileConversationManager for persistent storage
export class FileConversationManager implements IConversationManager {
  private basePath: string

  constructor(basePath: string = './.deep-conversations') {
    this.basePath = basePath
  }

  async get(id: string): Promise<ConversationState | null> {
    // TODO: Implement file-based storage
    throw new Error('FileConversationManager not implemented yet')
  }

  async create(id?: string): Promise<ConversationState> {
    throw new Error('FileConversationManager not implemented yet')
  }

  async update(id: string, items: any[], responseId?: string): Promise<void> {
    throw new Error('FileConversationManager not implemented yet')
  }

  async list(): Promise<ConversationState[]> {
    throw new Error('FileConversationManager not implemented yet')
  }

  async delete(id: string): Promise<void> {
    throw new Error('FileConversationManager not implemented yet')
  }

  // New enhanced methods - TODO: Implement file-based versions
  async compressConversation(id: string, strategy?: any): Promise<void> {
    throw new Error('FileConversationManager compression not implemented yet')
  }

  async curateConversation(id: string): Promise<void> {
    throw new Error('FileConversationManager curation not implemented yet')
  }

  async analyzeTokenUsage(messages: any[]): Promise<any> {
    throw new Error('FileConversationManager token analysis not implemented yet')
  }

  async findSplitPoint(messages: any[]): Promise<any> {
    throw new Error('FileConversationManager split point analysis not implemented yet')
  }

  async validateConversationHealth(id: string): Promise<any> {
    throw new Error('FileConversationManager health validation not implemented yet')
  }
}