// Context-Aware Deep Engine - Enhanced engine with IDE context integration
import { OpenAI } from 'openai'
import { v4 as uuidv4 } from 'uuid'
import type {
  IContextAwareDeepEngine,
  EnhancedDeepEvent,
  ContextAwareConversationState,
  DeepConfig,
  ContextAwareTurnContext,
  IDEContext,
  ContextDelta,
  IContextStore,
  IDEIntegration,
  ContextCompression
} from './types.js'
import type { Tool } from './types/index.js'
import { DeepEngine } from './deep-engine.js'
import { Turn } from './turn.js'
import { ContextStore } from './context/index.js'

/**
 * Context-aware extension of DeepEngine with IDE integration
 * Combines OpenAI Response API with intelligent IDE context management
 */
export class ContextAwareDeepEngine extends DeepEngine implements IContextAwareDeepEngine {
  private contextStore: IContextStore | null = null
  private ideIntegration: IDEIntegration | null = null

  constructor(config: DeepConfig) {
    super(config)

    // Initialize context store if enabled
    if (config.context.enabled) {
      this.contextStore = new ContextStore(config)
      this.setupContextEventHandlers()
    }
  }

  private setupContextEventHandlers(): void {
    if (!this.contextStore) return

    try {
      // Listen for context changes and emit events
      this.contextStore.onContextChange((delta) => {
        // Context changes will be included in the stream when processing messages
      })

      this.contextStore.onFileChange((change) => {
        // File changes will be included in the stream when processing messages
      })

      this.contextStore.onGitStateChange((gitState) => {
        // Git state changes will be included in the stream when processing messages
      })
    } catch (error) {
      console.error('Failed to setup context event handlers:', error)
    }
  }

  // IContextAwareDeepEngine implementation
  setContextStore(contextStore: IContextStore): void {
    this.contextStore = contextStore
    this.setupContextEventHandlers()
  }

  getContextStore(): IContextStore | null {
    return this.contextStore
  }

  async updateIDEContext(delta: ContextDelta): Promise<void> {
    if (this.contextStore) {
      await this.contextStore.updateContext(delta)
    }
  }

  async getIDEContext(): Promise<IDEContext | null> {
    if (this.contextStore) {
      return this.contextStore.getCurrentContext()
    }
    return null
  }

  async connectIDE(integration: IDEIntegration): Promise<void> {
    this.ideIntegration = integration

    try {
      await integration.initialize()

      // Set up IDE event handlers
      integration.onActiveFileChange(async (filePath) => {
        if (this.contextStore) {
          await this.contextStore.setActiveFile(filePath)
        }
      })

      integration.onCursorMove(async (line, column) => {
        if (this.contextStore) {
          await this.contextStore.setCursorPosition(line, column)
        }
      })

      integration.onSelectionChange(async (selection) => {
        if (this.contextStore && selection) {
          await this.contextStore.setSelectedText(
            selection.content,
            { line: selection.startLine, column: selection.startColumn },
            { line: selection.endLine, column: selection.endColumn }
          )
        }
      })

      integration.onFileCreate(async (filePath) => {
        if (this.contextStore) {
          await this.contextStore.trackFileChange({
            filePath,
            changeType: 'created',
            timestamp: new Date()
          })
        }
      })

      integration.onFileModify(async (filePath) => {
        if (this.contextStore) {
          await this.contextStore.trackFileChange({
            filePath,
            changeType: 'modified',
            timestamp: new Date()
          })
        }
      })

      integration.onFileDelete(async (filePath) => {
        if (this.contextStore) {
          await this.contextStore.trackFileChange({
            filePath,
            changeType: 'deleted',
            timestamp: new Date()
          })
        }
      })

      console.log(`Connected to ${integration.type} IDE`)
    } catch (error) {
      console.error('Failed to connect to IDE:', error)
      throw error
    }
  }

  async disconnectIDE(): Promise<void> {
    if (this.ideIntegration) {
      try {
        await this.ideIntegration.disconnect()
        this.ideIntegration = null
        console.log('Disconnected from IDE')
      } catch (error) {
        console.error('Failed to disconnect from IDE:', error)
        throw error
      }
    }
  }

  getIDEIntegration(): IDEIntegration | null {
    return this.ideIntegration
  }

  // Enhanced message processing with context awareness
  async *processMessageWithContext(
    input: string,
    conversationId?: string,
    contextOptions?: {
      includeContext?: boolean
      compressionStrategy?: ContextCompression['strategy']
      relevanceThreshold?: number
    }
  ): AsyncGenerator<EnhancedDeepEvent> {
    const finalConversationId = conversationId || uuidv4()
    const options = {
      includeContext: true,
      compressionStrategy: 'smart' as ContextCompression['strategy'],
      relevanceThreshold: 0.5,
      ...contextOptions
    }

    // Get current IDE context if available and requested
    let ideContext: IDEContext | null = null
    if (options.includeContext && this.contextStore) {
      ideContext = await this.contextStore.getCurrentContext()

      // Apply compression if needed
      if (ideContext && ideContext.tokenCount > (this.config.context.compressionThreshold || 4000)) {
        const compressor = this.contextStore as any // Access internal compressor
        if (compressor.contextCompressor) {
          const originalTokens = ideContext.tokenCount
          ideContext = await compressor.contextCompressor.compress(ideContext, options.compressionStrategy)

          // Emit compression event
          yield {
            type: 'context_compression',
            data: {
              originalTokens,
              compressedTokens: ideContext.tokenCount,
              strategy: options.compressionStrategy
            }
          }
        }
      }

      // Apply relevance filtering
      if (ideContext && options.relevanceThreshold > 0) {
        const analyzer = this.contextStore as any // Access internal analyzer
        if (analyzer.contextAnalyzer) {
          const relevanceAnalysis = await analyzer.contextAnalyzer.analyzeRelevance(
            ideContext.openFiles.map(f => f.path),
            ideContext
          )

          ideContext = await analyzer.contextAnalyzer.filterRelevant(
            ideContext,
            options.relevanceThreshold
          )

          // Emit relevance analysis event
          yield {
            type: 'context_relevance_analysis',
            data: {
              analysis: relevanceAnalysis,
              threshold: options.relevanceThreshold
            }
          }
        }
      }

      // Emit context update event
      if (ideContext) {
        yield {
          type: 'context_update',
          data: {
            delta: {
              added: ideContext,
              removed: [],
              modified: {},
              timestamp: new Date(),
              tokenDelta: 0,
              reason: 'context_included'
            },
            context: ideContext
          }
        }
      }
    }

    // Create enhanced turn context
    const turnContext: ContextAwareTurnContext = {
      conversationId: finalConversationId,
      userInput: input,
      tools: this.getFilteredTools(),
      ideContext,
      contextCompressionEnabled: options.compressionStrategy !== undefined,
      relevanceThreshold: options.relevanceThreshold
    }

    // Process message with enhanced context
    yield* this.processMessageWithEnhancedContext(turnContext)
  }

  private async *processMessageWithEnhancedContext(
    context: ContextAwareTurnContext
  ): AsyncGenerator<EnhancedDeepEvent> {
    // Start turn
    yield {
      type: 'turn_start',
      data: {
        conversationId: context.conversationId,
        input: context.userInput
      }
    }

    try {
      // Get or create conversation
      let conversation = await this.conversationManager.get(context.conversationId)
      if (!conversation) {
        conversation = await this.conversationManager.create(context.conversationId)
      }

      // Add IDE context to conversation if available
      if (context.ideContext) {
        // Enhanced conversation state with context
        const contextAwareConversation: ContextAwareConversationState = {
          ...conversation,
          context: context.ideContext,
          contextHistory: [], // TODO: Track context deltas over time
          relevanceAnalysis: [] // TODO: Include relevance analysis
        }
      }

      // Build enhanced turn context with IDE context
      const enhancedUserInput = this.buildContextAwareInput(context)

      const turnContext = {
        conversationId: context.conversationId,
        userInput: enhancedUserInput,
        tools: context.tools
      }

      // Create standard turn with context-enhanced input
      const turn = new Turn(
        turnContext,
        this.responseClient,
        this.toolRegistry,
        this.conversationManager
      )

      // Stream events from turn processing
      for await (const event of turn.run()) {
        yield event
      }

      // Update conversation with results
      // TODO: Update with context-aware results

    } catch (error) {
      yield {
        type: 'error',
        data: {
          error: error instanceof Error ? error.message : String(error),
          code: 'CONTEXT_PROCESSING_ERROR'
        }
      }
    }
  }

  private buildContextAwareInput(context: ContextAwareTurnContext): any {
    // Build input that includes IDE context information
    let contextPrompt = ''

    if (context.ideContext) {
      contextPrompt = this.formatContextForPrompt(context.ideContext)
    }

    // Combine user input with context
    const enhancedInput = contextPrompt
      ? `Context:\n${contextPrompt}\n\nUser Request:\n${context.userInput}`
      : context.userInput

    return enhancedInput
  }

  private formatContextForPrompt(ideContext: IDEContext): string {
    const parts: string[] = []

    // Active file information
    const activeFile = ideContext.openFiles.find(f => f.isActive)
    if (activeFile) {
      parts.push(`Active file: ${activeFile.path}`)

      if (activeFile.cursor) {
        parts.push(`Cursor position: line ${activeFile.cursor.line}, column ${activeFile.cursor.character}`)
      }

      if (activeFile.selectedText) {
        parts.push(`Selected text: ${activeFile.selectedText}`)
      }
    }

    // Open files
    if (ideContext.openFiles.length > 0) {
      const fileList = ideContext.openFiles
        .map(f => `- ${f.path}${f.isActive ? ' (active)' : ''}`)
        .join('\n')
      parts.push(`Open files:\n${fileList}`)
    }

    // Git status
    if (ideContext.gitState.status !== 'unknown') {
      parts.push(`Git branch: ${ideContext.gitState.branch}`)
      parts.push(`Git status: ${ideContext.gitState.status}`)

      if (ideContext.gitState.modifiedFiles.length > 0) {
        parts.push(`Modified files: ${ideContext.gitState.modifiedFiles.join(', ')}`)
      }
    }

    // Recent changes
    if (ideContext.recentChanges.length > 0) {
      const recentChanges = ideContext.recentChanges
        .slice(0, 5) // Show only 5 most recent
        .map(c => `- ${c.changeType}: ${c.filePath}`)
        .join('\n')
      parts.push(`Recent changes:\n${recentChanges}`)
    }

    // Project information
    parts.push(`Project root: ${ideContext.projectRoot}`)
    parts.push(`Project type: ${ideContext.workspaceSettings.projectType || 'unknown'}`)

    return parts.join('\n\n')
  }

  // Override base class method to use enhanced processing
  async *processMessage(
    input: string,
    conversationId?: string
  ): AsyncGenerator<EnhancedDeepEvent> {
    yield* this.processMessageWithContext(input, conversationId, {
      includeContext: this.config.context.enabled
    })
  }

  // Cleanup
  dispose(): void {
    if (this.contextStore && typeof (this.contextStore as any).dispose === 'function') {
      (this.contextStore as any).dispose()
    }

    if (this.ideIntegration) {
      this.ideIntegration.disconnect().catch(console.error)
    }
  }
}

