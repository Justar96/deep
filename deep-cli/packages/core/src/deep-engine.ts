// Deep Engine - main orchestrator for the AI agent
import { OpenAI } from 'openai'
import { v4 as uuidv4 } from 'uuid'
import type { 
  IDeepEngine, 
  DeepEvent, 
  ConversationState, 
  DeepConfig,
  TurnContext 
} from './types.js'
import { OpenAIResponseClient } from './response-client.js'
import { MemoryConversationManager } from './conversation-manager.js'
import { BasicToolRegistry } from './tool-registry.js'
import { Turn } from './turn.js'

export class DeepEngine implements IDeepEngine {
  private client: OpenAI
  private responseClient: OpenAIResponseClient
  private conversationManager: MemoryConversationManager
  private toolRegistry: BasicToolRegistry
  private config: DeepConfig

  constructor(config: DeepConfig) {
    this.config = config
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    })
    
    this.responseClient = new OpenAIResponseClient(this.client, config)
    this.conversationManager = new MemoryConversationManager()
    this.toolRegistry = new BasicToolRegistry()
  }

  async *processMessage(
    input: string, 
    conversationId?: string
  ): AsyncGenerator<DeepEvent> {
    const finalConversationId = conversationId || uuidv4()
    
    const context: TurnContext = {
      conversationId: finalConversationId,
      userInput: input,
      tools: this.getFilteredTools(),
    }

    const turn = new Turn(
      context,
      this.responseClient,
      this.toolRegistry,
      this.conversationManager
    )

    // Subscribe to turn events and forward them
    turn.on('event', (event: DeepEvent) => {
      // This will be yielded in the generator
    })

    for await (const event of turn.run()) {
      yield event
    }
  }

  async getConversation(id: string): Promise<ConversationState | null> {
    return this.conversationManager.get(id)
  }

  async listConversations(): Promise<ConversationState[]> {
    return this.conversationManager.list()
  }

  async clearConversation(id: string): Promise<void> {
    await this.conversationManager.delete(id)
  }

  // Stream-enabled version for real-time UI
  async *processMessageStream(
    input: string,
    conversationId?: string
  ): AsyncGenerator<DeepEvent> {
    // Same as processMessage but with streaming enabled
    yield* this.processMessage(input, conversationId)
  }

  private getFilteredTools(): any[] {
    const trusted = true // TODO: Implement workspace trust detection
    const availableTools = this.toolRegistry.getTools(trusted)
    
    // Filter by allowed tools if configured
    if (this.config.allowedTools.length > 0) {
      return availableTools.filter(tool => {
        if (tool.type === 'function' && 'name' in tool) {
          return this.config.allowedTools.includes(tool.name)
        }
        return this.config.allowedTools.includes(tool.type)
      })
    }
    
    return availableTools
  }

  // Utility methods for configuration and management
  getConfig(): DeepConfig {
    return { ...this.config }
  }

  updateConfig(updates: Partial<DeepConfig>): void {
    this.config = { ...this.config, ...updates }
    
    // Recreate client if API settings changed
    if (updates.apiKey || updates.baseUrl) {
      this.client = new OpenAI({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseUrl,
      })
      this.responseClient = new OpenAIResponseClient(this.client, this.config)
    }
  }

  // Tool management
  registerTool(
    tool: any,
    executor: (input: string, callId: string) => Promise<string>,
    trusted: boolean = true
  ): void {
    this.toolRegistry.registerTool(tool, executor, trusted)
  }

  // Health check
  async healthCheck(): Promise<{ status: 'ok' | 'error'; message?: string }> {
    try {
      // Simple test call to verify API connectivity
      await this.responseClient.create({
        model: this.config.model,
        input: 'test',
        max_output_tokens: 1,
      })
      
      return { status: 'ok' }
    } catch (error) {
      return { 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }
}