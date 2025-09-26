// Conversation Compression Service - Intelligent compression with context preservation
import { OpenAI } from 'openai'
import { get_encoding } from 'tiktoken'
import type {
  ConversationCompression,
  ConversationMetrics,
  SplitPointAnalysis,
  ConversationHealth,
  DeepConfig
} from './types.js'

export class ConversationCompressionService {
  private client: OpenAI
  private config: DeepConfig
  private encoding: ReturnType<typeof get_encoding> | null = null

  constructor(client: OpenAI, config: DeepConfig) {
    this.client = client
    this.config = config
    this.initializeTokenizer()

    // Ensure cleanup on process termination
    this.setupProcessCleanup()
  }

  private initializeTokenizer(): void {
    // Clean up existing encoding first to prevent resource leak
    this.cleanup()

    try {
      // Use the tokenizer appropriate for the model
      const model = this.config.model || 'gpt-4o'
      if (model.startsWith('gpt-5') || model.includes('o1')) {
        // Use gpt-4o tokenizer for GPT-5 and o1 models (fallback)
        this.encoding = get_encoding('o200k_base')
      } else if (model.startsWith('gpt-4')) {
        this.encoding = get_encoding('cl100k_base')
      } else if (model.startsWith('gpt-3')) {
        this.encoding = get_encoding('p50k_base')
      } else {
        // Default to GPT-4 tokenizer
        this.encoding = get_encoding('cl100k_base')
      }
    } catch (error) {
      console.warn('[ConversationCompression] Failed to initialize tiktoken, falling back to estimation:', error)
      this.encoding = null
    }
  }

  /**
   * Setup process cleanup handlers to prevent resource leaks
   * Skip in test environment to prevent listener accumulation
   */
  private setupProcessCleanup(): void {
    // Skip process cleanup setup in test environment to prevent memory leaks
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
      return
    }

    // Cleanup on process termination
    const cleanupHandler = () => {
      this.cleanup()
    }

    // Handle various termination signals
    process.on('exit', cleanupHandler)
    process.on('SIGINT', cleanupHandler)
    process.on('SIGTERM', cleanupHandler)
    process.on('uncaughtException', (error) => {
      console.error('[ConversationCompression] Uncaught exception, cleaning up:', error)
      this.cleanup()
      process.exit(1)
    })
    process.on('unhandledRejection', (reason) => {
      console.error('[ConversationCompression] Unhandled rejection, cleaning up:', reason)
      this.cleanup()
      process.exit(1)
    })
  }

  /**
   * Analyze token usage of messages using tiktoken for accurate tokenization
   */
  async analyzeTokenUsage(messages: any[]): Promise<ConversationMetrics['tokenUsage']> {
    let inputTokens = 0
    let outputTokens = 0

    for (const message of messages) {
      if (message.type === 'message') {
        const content = message.content || []
        for (const item of content) {
          const text = item.text || ''
          const tokenCount = this.countTokens(text)

          if (message.role === 'user') {
            inputTokens += tokenCount
          } else {
            outputTokens += tokenCount
          }
        }
      } else if (message.type === 'function_call') {
        // Function calls count as output tokens
        const argsText = JSON.stringify(message.arguments || message.input || {})
        outputTokens += this.countTokens(argsText)
      } else if (message.type === 'function_call_output') {
        // Function results count as input tokens for next turn
        const outputText = message.output || ''
        inputTokens += this.countTokens(outputText)
      }
    }

    return {
      input: inputTokens,
      output: outputTokens,
      total: inputTokens + outputTokens
    }
  }

  /**
   * Count tokens in text using tiktoken or fallback estimation
   */
  private countTokens(text: string): number {
    if (!text) return 0

    if (this.encoding) {
      try {
        return this.encoding.encode(text).length
      } catch (error) {
        console.warn('[ConversationCompression] Token counting error, using fallback:', error)
      }
    }

    // Fallback estimation - more accurate than the previous 4:1 ratio
    // Based on empirical analysis: ~3.5 chars per token for English text
    return Math.ceil(text.length / 3.5)
  }

  /**
   * Find optimal split point preserving function call chains
   */
  async findSplitPoint(messages: any[]): Promise<SplitPointAnalysis> {
    const analysisPrompt = `Analyze this conversation to find the optimal split point for compression.

GOALS:
1. Preserve complete function call chains (function_call + function_call_output pairs)
2. Keep recent context that's most relevant
3. Maintain conversation coherence
4. Minimize information loss

CONVERSATION:
${JSON.stringify(messages.slice(-20), null, 2)}

Respond with analysis in this format:
SPLIT_INDEX: [index where to split]
REASONING: [why this split point preserves important context]
CONFIDENCE: [0-100 confidence score]
PRESERVED_FUNCTIONS: [list of preserved function calls]`

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini', // Use cheaper model for analysis
        messages: [{ role: 'user', content: analysisPrompt }],
        max_tokens: 500
      })

      const content = response.choices[0]?.message?.content || ''

      // Parse the response
      const splitMatch = content.match(/SPLIT_INDEX:\s*(\d+)/)
      const reasoningMatch = content.match(/REASONING:\s*(.+?)(?=\n[A-Z_]+:|$)/s)
      const confidenceMatch = content.match(/CONFIDENCE:\s*(\d+)/)

      const splitIndex = splitMatch?.[1] ? parseInt(splitMatch[1]) : Math.floor(messages.length * 0.3)
      const reasoning = reasoningMatch?.[1]?.trim() || 'Automatic split at 30% point'
      const confidence = confidenceMatch?.[1] ? parseInt(confidenceMatch[1]) : 50


      return {
        splitIndex: Math.max(0, Math.min(splitIndex, messages.length)),
        preservedItems: messages.slice(splitIndex),
        compressibleItems: messages.slice(0, splitIndex),
        reasoning,
        confidence
      }
    } catch (error) {
      // Fallback to simple split strategy
      const splitIndex = Math.floor(messages.length * 0.3)

      return {
        splitIndex,
        preservedItems: messages.slice(splitIndex),
        compressibleItems: messages.slice(0, splitIndex),
        reasoning: 'Fallback split due to analysis error',
        confidence: 30
      }
    }
  }

  /**
   * Compress conversation using OpenAI summarization
   */
  async compressConversation(
    messages: any[],
    strategy: ConversationCompression['strategy'] = 'summarize'
  ): Promise<{ compressedMessages: any[]; compressionRatio: number }> {
    if (messages.length < 10) {
      return { compressedMessages: messages, compressionRatio: 1.0 }
    }

    const splitAnalysis = await this.findSplitPoint(messages)

    switch (strategy) {
      case 'summarize':
        return this.summarizeMessages(splitAnalysis)

      case 'selective':
        return this.selectiveCompression(splitAnalysis)

      case 'truncate':
        return this.truncateMessages(splitAnalysis)

      default:
        return this.summarizeMessages(splitAnalysis)
    }
  }

  /**
   * Summarize compressible portion using OpenAI
   */
  private async summarizeMessages(splitAnalysis: SplitPointAnalysis): Promise<{ compressedMessages: any[]; compressionRatio: number }> {
    if (splitAnalysis.compressibleItems.length === 0) {
      return {
        compressedMessages: splitAnalysis.preservedItems,
        compressionRatio: 1.0
      }
    }

    const summaryPrompt = `Summarize this conversation segment, preserving:
1. Key decisions and outcomes
2. Important context for future messages
3. Tool usage patterns and results
4. User preferences and requirements

CONVERSATION SEGMENT:
${JSON.stringify(splitAnalysis.compressibleItems, null, 2)}

Create a concise summary that maintains conversation continuity.`

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: summaryPrompt }],
        max_tokens: 1000
      })

      const summary = response.choices[0]?.message?.content || 'Conversation summary unavailable'

      // Create summary message in OpenAI format
      const summaryMessage = {
        type: 'message',
        role: 'system',
        content: [{
          type: 'text',
          text: `[COMPRESSED SUMMARY - ${splitAnalysis.compressibleItems.length} messages]: ${summary}`
        }]
      }

      const compressedMessages = [summaryMessage, ...splitAnalysis.preservedItems]
      const originalLength = splitAnalysis.compressibleItems.length + splitAnalysis.preservedItems.length
      const compressionRatio = compressedMessages.length / originalLength

      return { compressedMessages, compressionRatio }
    } catch (error) {
      // Fallback to truncation if summarization fails
      return this.truncateMessages(splitAnalysis)
    }
  }

  /**
   * Selective compression - remove less important messages but preserve function chains
   */
  private async selectiveCompression(splitAnalysis: SplitPointAnalysis): Promise<{ compressedMessages: any[]; compressionRatio: number }> {
    const { compressibleItems, preservedItems } = splitAnalysis

    // Keep function call chains, user messages, and every 3rd assistant message
    const selectedMessages: any[] = []
    let pendingFunctionCall: any = null

    for (const message of compressibleItems) {
      // Always preserve function call chains
      if (message.type === 'function_call') {
        pendingFunctionCall = message
        selectedMessages.push(message)
      } else if (message.type === 'function_call_output' && pendingFunctionCall) {
        selectedMessages.push(message)
        pendingFunctionCall = null
      } else if (message.type === 'message' && message.role === 'user') {
        // Always keep user messages
        selectedMessages.push(message)
      } else if (message.type === 'message' && message.role === 'assistant') {
        // Keep every 3rd assistant message
        if (selectedMessages.length % 3 === 0) {
          selectedMessages.push(message)
        }
      }
    }

    const compressedMessages = [...selectedMessages, ...preservedItems]
    const originalLength = compressibleItems.length + preservedItems.length
    const compressionRatio = compressedMessages.length / originalLength

    return { compressedMessages, compressionRatio }
  }

  /**
   * Simple truncation - remove oldest messages
   */
  private async truncateMessages(splitAnalysis: SplitPointAnalysis): Promise<{ compressedMessages: any[]; compressionRatio: number }> {
    const originalLength = splitAnalysis.compressibleItems.length + splitAnalysis.preservedItems.length
    const compressionRatio = splitAnalysis.preservedItems.length / originalLength

    return {
      compressedMessages: splitAnalysis.preservedItems,
      compressionRatio
    }
  }

  /**
   * Curate conversation by removing invalid/malformed responses
   */
  async curateConversation(messages: any[]): Promise<any[]> {
    const validMessages: any[] = []

    for (const message of messages) {
      // Check message validity
      if (this.isValidMessage(message)) {
        validMessages.push(message)
      } else if (this.config.logPaths) {
        console.log('[ConversationCuration] Removed invalid message:', message)
      }
    }

    return validMessages
  }

  /**
   * Validate message format and content
   */
  private isValidMessage(message: any): boolean {
    // Basic structure validation
    if (!message || typeof message !== 'object') {
      return false
    }

    // Check required fields based on message type
    switch (message.type) {
      case 'message':
        return !!(message.role && message.content)

      case 'function_call':
        return !!(message.name && message.call_id)

      case 'function_call_output':
        return !!(message.call_id && typeof message.output === 'string')

      default:
        return true // Allow unknown types for forward compatibility
    }
  }

  /**
   * Assess conversation health
   */
  async validateConversationHealth(messages: any[]): Promise<ConversationHealth> {
    let hasInvalidResponses = false
    let continuityScore = 1.0
    const issues: string[] = []

    // Check for invalid messages
    const invalidCount = messages.filter(m => !this.isValidMessage(m)).length
    if (invalidCount > 0) {
      hasInvalidResponses = true
      issues.push(`${invalidCount} invalid messages found`)
    }

    // Check for broken function call chains
    let pendingFunctionCall: string | null = null
    for (const message of messages) {
      if (message.type === 'function_call') {
        if (pendingFunctionCall) {
          issues.push(`Orphaned function call: ${pendingFunctionCall}`)
          continuityScore -= 0.1
        }
        pendingFunctionCall = message.call_id
      } else if (message.type === 'function_call_output') {
        if (pendingFunctionCall === message.call_id) {
          pendingFunctionCall = null
        } else {
          issues.push(`Unmatched function output: ${message.call_id}`)
          continuityScore -= 0.1
        }
      }
    }

    // Check token usage health
    const tokenUsage = await this.analyzeTokenUsage(messages)
    if (tokenUsage.total > this.config.conversation.maxTokens) {
      issues.push(`Token count (${tokenUsage.total}) exceeds limit (${this.config.conversation.maxTokens})`)
      continuityScore -= 0.2
    }

    return {
      isValid: issues.length === 0,
      hasInvalidResponses,
      continuityScore: Math.max(0, Math.min(1, continuityScore)),
      issues
    }
  }

  /**
   * Check if conversation needs compression
   */
  shouldCompress(tokenUsage: ConversationMetrics['tokenUsage'], config: ConversationCompression): boolean {
    if (!config.enabled) return false

    const threshold = config.threshold * this.config.conversation.maxTokens
    return tokenUsage.total >= threshold
  }

  /**
   * Clean up resources (call on shutdown) - Enhanced with safety checks
   */
  cleanup(): void {
    if (this.encoding) {
      try {
        // Ensure encoding is valid before attempting to free
        if (typeof this.encoding.free === 'function') {
          this.encoding.free()
        }
      } catch (error) {
        console.warn('[ConversationCompression] Error during cleanup:', error)
      } finally {
        // Always null the encoding reference to prevent reuse
        this.encoding = null
      }
    }
  }

  /**
   * Update configuration and reinitialize tokenizer if needed
   */
  updateConfig(newConfig: DeepConfig): void {
    const oldModel = this.config.model
    this.config = newConfig

    // Reinitialize tokenizer if model changed
    if (newConfig.model !== oldModel) {
      this.initializeTokenizer()
    }
  }
}