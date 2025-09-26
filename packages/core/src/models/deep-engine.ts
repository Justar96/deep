// Deep Engine - main orchestrator for the AI agent
import { OpenAI } from 'openai'
import { v4 as uuidv4 } from 'uuid'
import type { 
  IDeepEngine, 
  DeepEvent, 
  ConversationState, 
  DeepConfig,
  TurnContext 
} from '../types/core-types.js'
import type { Tool } from '../types/index.js'
import { OpenAIResponseClient } from '../responses/response-client.js'
import { MemoryConversationManager } from '../conversations/conversation-manager.js'
import { BaseToolRegistryWrapper } from '../tools/base-tool-registry.js'
import { ToolRegistry } from '../tools/tool-registry.js'
import { Turn } from '../conversations/turn.js'

export class DeepEngine implements IDeepEngine {
  private client: OpenAI
  private responseClient: OpenAIResponseClient
  private conversationManager: MemoryConversationManager
  private toolRegistry: ToolRegistry
  private config: DeepConfig

  constructor(config: DeepConfig) {
    this.config = config
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    })

    this.responseClient = new OpenAIResponseClient(this.client, config)
    // Initialize enhanced conversation manager with compression support
    this.conversationManager = new MemoryConversationManager(this.client, config)
    // Initialize tool registry with Sprint 2 features
    this.toolRegistry = new ToolRegistry(config)
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

    // Directly yield events from turn execution (no need for separate event subscription)
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

  private getFilteredTools(): Tool[] {
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

      // Update conversation manager with new client and config
      this.conversationManager.initializeCompressionService(this.client, this.config)
    }
  }

  // Enhanced tool management (Sprint 2)
  registerTool(
    tool: Tool,
    executor: (input: string, callId: string) => Promise<string>,
    trusted: boolean = true
  ): void {
    this.toolRegistry.registerTool(tool, executor, trusted)
  }

  // Sprint 2: Enhanced tool management methods
  getToolAuditTrail(limit?: number): import('../types/core-types.js').ToolAuditEntry[] {
    return this.toolRegistry.getAuditTrail(limit)
  }

  getToolSecurityReport(): import('../types/index.js').ToolSecurityReport {
    return this.toolRegistry.getSecurityReport()
  }

  async emergencyStopTools(): Promise<void> {
    await this.toolRegistry.emergencyStop()
  }

  resetToolEmergencyStop(): void {
    this.toolRegistry.resetEmergencyStop()
  }

  getActiveToolExecutions(): import('../types/index.js').ActiveExecution[] {
    return this.toolRegistry.getActiveExecutions()
  }

  approveToolRequest(requestId: string, reason?: string): boolean {
    return (this.toolRegistry as unknown as { confirmationBus?: { approveRequest(id: string, reason?: string): boolean } }).confirmationBus?.approveRequest(requestId, reason) || false
  }

  denyToolRequest(requestId: string, reason?: string): boolean {
    return (this.toolRegistry as unknown as { confirmationBus?: { denyRequest(id: string, reason?: string): boolean } }).confirmationBus?.denyRequest(requestId, reason) || false
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