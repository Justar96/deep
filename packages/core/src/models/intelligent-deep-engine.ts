// Intelligent Deep Engine with model routing and optimization
import { OpenAI } from 'openai'
import { v4 as uuidv4 } from 'uuid'
import type {
  IDeepEngine,
  DeepEvent,
  ConversationState,
  DeepConfig,
  TurnContext,
  ModelIntelligentDeepEvent,
  RequestComplexityAnalysis,
  ModelMetrics
} from '../types/core-types.js'
import type { Tool } from '../types/index.js'
import { MemoryConversationManager } from '../conversations/conversation-manager.js'
import { BaseToolRegistryWrapper } from '../tools/base-tool-registry.js'
import { ToolRegistry } from '../tools/tool-registry.js'
import { Turn } from '../conversations/turn.js'
import { IntelligentResponseClient } from './intelligent-response-client.js'
import { ComplexityAnalyzer } from './complexity-analyzer.js'

/**
 * Intelligent Deep Engine that adds model routing and optimization
 * to the base Deep Engine functionality
 */
export class IntelligentDeepEngine implements IDeepEngine {
  private client: OpenAI
  private responseClient: IntelligentResponseClient
  private conversationManager: MemoryConversationManager
  private toolRegistry: ToolRegistry
  private config: DeepConfig
  private complexityAnalyzer: ComplexityAnalyzer

  constructor(config: DeepConfig) {
    this.config = config
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    })

    // Use intelligent response client instead of basic one
    this.responseClient = new IntelligentResponseClient(this.client, config)
    this.conversationManager = new MemoryConversationManager(this.client, config)
    this.toolRegistry = new ToolRegistry(config)
    this.complexityAnalyzer = new ComplexityAnalyzer()

    this.setupModelIntelligenceEvents()
  }

  private setupModelIntelligenceEvents(): void {
    // Forward model routing events from response client
    this.responseClient.on('model_routing_event', (event) => {
      // In a real implementation, this would be forwarded to the UI or logging system
      console.log('Model routing event:', event)
    })
  }

  async *processMessage(
    input: string,
    conversationId?: string
  ): AsyncGenerator<ModelIntelligentDeepEvent> {
    const finalConversationId = conversationId || uuidv4()

    // Get conversation history for complexity analysis
    const conversation = await this.conversationManager.get(finalConversationId)
    const conversationHistory = conversation?.messages || []

    // Analyze request complexity first
    const complexity = await this.complexityAnalyzer.analyzeComplexity(
      input,
      undefined, // TODO: Get IDE context if available
      conversationHistory
    )

    // Emit complexity analysis event
    yield {
      type: 'model_selection',
      data: {
        selectedModel: complexity.suggestedModel,
        complexity,
        strategy: this.findMatchingStrategy(complexity)
      }
    }

    // Create turn context with complexity-aware tools
    const context: TurnContext = {
      conversationId: finalConversationId,
      userInput: input,
      tools: this.getComplexityAwareTools(complexity),
    }

    const turn = new Turn(
      context,
      this.responseClient, // Use intelligent client
      this.toolRegistry,
      this.conversationManager
    )

    // Stream events from turn execution
    for await (const event of turn.run()) {
      yield event
    }

    // Record performance metrics
    await this.recordTurnMetrics(complexity, Date.now())
  }

  private findMatchingStrategy(complexity: RequestComplexityAnalysis) {
    return this.config.modelIntelligence.routingStrategies.find(
      s => s.complexity === complexity.complexity
    ) || this.config.modelIntelligence.routingStrategies[0]
  }

  private getComplexityAwareTools(complexity: RequestComplexityAnalysis): Tool[] {
    const allTools = this.getFilteredTools()

    // For simple requests, limit tool availability to improve performance
    if (complexity.complexity === 'simple' && !complexity.factors.hasToolCalls) {
      return allTools.filter(tool => {
        // Only include basic tools for simple requests
        if (tool.type === 'function' && 'name' in tool) {
          const basicTools = ['read_file', 'write_file', 'list_directory', 'grep']
          return basicTools.includes(tool.name)
        }
        return false
      })
    }

    return allTools
  }

  private async recordTurnMetrics(
    complexity: RequestComplexityAnalysis,
    startTime: number
  ): Promise<void> {
    // This would record metrics about the entire turn
    // In a real implementation, this would be more sophisticated
    const duration = Date.now() - startTime
    console.log(`Turn completed in ${duration}ms for ${complexity.complexity} request`)
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
  ): AsyncGenerator<ModelIntelligentDeepEvent> {
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

  // Configuration and management methods
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

      // Recreate intelligent response client
      this.responseClient = new IntelligentResponseClient(this.client, this.config)
      this.setupModelIntelligenceEvents()

      // Update conversation manager with new client and config
      this.conversationManager.initializeCompressionService(this.client, this.config)
    }
  }

  // Enhanced tool management with model intelligence
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

  // Model intelligence specific methods
  async getModelMetrics(modelName?: string): Promise<ModelMetrics[]> {
    return this.responseClient.getModelMetrics(modelName)
  }

  async getSystemStatus(): Promise<{
    modelsAvailable: number
    totalRequests: number
    totalCost: number
    averageLatency: number
    requestHistory: Array<{ model: string; timestamp: Date; success: boolean }>
  }> {
    return this.responseClient.getSystemStatus()
  }

  async performModelHealthCheck(): Promise<{ healthy: boolean; issues: string[] }> {
    return this.responseClient.performHealthCheck()
  }

  async resetModelCircuitBreaker(modelName: string): Promise<void> {
    await this.responseClient.resetCircuitBreaker(modelName)
  }

  async analyzeRequestComplexity(input: string): Promise<RequestComplexityAnalysis> {
    const conversation = await this.conversationManager.get('current') // Would be passed properly
    return this.complexityAnalyzer.analyzeComplexity(
      input,
      undefined, // TODO: Get IDE context
      conversation?.messages
    )
  }

  // Health check that includes model intelligence
  async healthCheck(): Promise<{ status: 'ok' | 'error'; message?: string; details?: object }> {
    try {
      // Check basic connectivity
      const basicHealth = await this.basicHealthCheck()
      if (basicHealth.status === 'error') {
        return basicHealth
      }

      // Check model intelligence health
      const modelHealth = await this.performModelHealthCheck()
      const systemStatus = await this.getSystemStatus()

      return {
        status: modelHealth.healthy ? 'ok' : 'error',
        message: modelHealth.healthy ? 'All systems operational' : 'Model intelligence issues detected',
        details: {
          basicHealth,
          modelHealth,
          systemStatus
        }
      }
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: { error }
      }
    }
  }

  private async basicHealthCheck(): Promise<{ status: 'ok' | 'error'; message?: string }> {
    try {
      // Simple test call to verify API connectivity - would need to adapt for Responses API
      // This is a placeholder - in real implementation would use a minimal test request
      return { status: 'ok' }
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}