// Intelligent Response Client with model routing and optimization
import type { OpenAI } from 'openai'
import { EventEmitter } from 'events'
import type {
  IResponseClient,
  DeepConfig,
  RequestComplexityAnalysis,
  ModelRoutingEvent,
  ModelMetrics,
  IDEContext
} from '../types/core-types.js'
import type {
  ResponseCreateParams,
  ResponseObject,
  Item,
  Usage
} from '../types/index.js'
import { OpenAIResponseClient } from '../responses/response-client.js'
import { ModelIntelligence } from './model-intelligence.js'
import { ComplexityAnalyzer } from './complexity-analyzer.js'

/**
 * Intelligent Response Client that adds model routing and optimization
 * to the base OpenAI Response Client
 */
export class IntelligentResponseClient extends EventEmitter implements IResponseClient {
  private baseClient: OpenAIResponseClient
  private modelIntelligence: ModelIntelligence
  private complexityAnalyzer: ComplexityAnalyzer
  private requestHistory: Array<{
    input: string
    model: string
    complexity: RequestComplexityAnalysis
    timestamp: Date
    latency?: number
    tokens?: Usage
    success: boolean
    error?: string
  }> = []

  constructor(
    private openaiClient: OpenAI,
    private config: DeepConfig
  ) {
    super()

    this.baseClient = new OpenAIResponseClient(openaiClient, config)
    this.modelIntelligence = new ModelIntelligence(config.modelIntelligence, openaiClient)
    this.complexityAnalyzer = new ComplexityAnalyzer()

    this.setupModelIntelligenceEvents()
  }

  private setupModelIntelligenceEvents(): void {
    // Monitor circuit breaker state changes
    this.modelIntelligence.on?.('circuit_breaker_change', (data) => {
      this.emit('model_routing_event', {
        type: 'circuit_breaker_state_change',
        data
      } as ModelRoutingEvent)
    })
  }

  async create(params: ResponseCreateParams): Promise<ResponseObject> {
    const startTime = Date.now()

    try {
      // Step 1: Analyze request complexity
      const complexity = await this.analyzeRequestComplexity(params)

      // Step 2: Select optimal model
      const selectedModel = await this.selectModel(complexity, params.model)

      // Step 3: Optimize parameters for selected model
      const optimizedParams = await this.optimizeParameters(params, selectedModel, complexity)

      // Step 4: Emit model selection event
      this.emitModelSelectionEvent(selectedModel, complexity)

      // Step 5: Execute request with model intelligence
      const response = await this.executeWithIntelligence(optimizedParams, selectedModel, startTime)

      // Step 6: Record metrics
      await this.recordRequestMetrics(selectedModel, startTime, response, complexity, true)

      return response

    } catch (error) {
      // Handle errors with fallback logic
      return this.handleRequestError(params, error as Error, startTime)
    }
  }

  async *stream(params: ResponseCreateParams): AsyncIterable<ResponseObject> {
    const startTime = Date.now()

    try {
      // Same intelligence logic for streaming
      const complexity = await this.analyzeRequestComplexity(params)
      const selectedModel = await this.selectModel(complexity, params.model)
      const optimizedParams = await this.optimizeParameters(params, selectedModel, complexity)

      this.emitModelSelectionEvent(selectedModel, complexity)

      // Stream with intelligent model
      const actualParams = { ...optimizedParams, model: selectedModel }

      let response: ResponseObject | undefined
      for await (const chunk of this.baseClient.stream(actualParams)) {
        response = chunk
        yield chunk
      }

      // Record metrics after streaming completes
      if (response) {
        await this.recordRequestMetrics(selectedModel, startTime, response, complexity, true)
      }

    } catch (error) {
      // Handle streaming errors
      yield await this.handleRequestError(params, error as Error, startTime)
    }
  }

  async followup(params: {
    input: Item[]
    previousResponseId: string
    tools?: unknown[]
    maxOutputTokens?: number
  }): Promise<ResponseObject> {
    const startTime = Date.now()

    try {
      // Analyze complexity for followup
      const inputText = this.extractTextFromItems(params.input)
      const complexity = await this.complexityAnalyzer.analyzeComplexity(inputText)

      // Select model for followup (may be different from initial)
      const selectedModel = await this.modelIntelligence.selectOptimalModel(complexity)

      // Create followup params with selected model
      const followupParams = {
        ...params,
        model: selectedModel
      }

      const response = await this.baseClient.followup(followupParams)

      await this.recordRequestMetrics(selectedModel, startTime, response, complexity, true)

      return response

    } catch (error) {
      // Handle followup errors
      const fallbackModel = await this.handleModelFailure(this.config.model, error as Error)
      const fallbackParams = { ...params, model: fallbackModel }

      const response = await this.baseClient.followup(fallbackParams)
      await this.recordRequestMetrics(fallbackModel, startTime, response, undefined, false, (error as Error).message)

      return response
    }
  }

  private async analyzeRequestComplexity(params: ResponseCreateParams): Promise<RequestComplexityAnalysis> {
    const inputText = typeof params.input === 'string'
      ? params.input
      : this.extractTextFromItems(params.input as Item[])

    // Get conversation history if available
    const conversationHistory = Array.isArray(params.input) ? params.input : undefined

    // Analyze with IDE context if available (would need to be passed in real implementation)
    const ideContext = undefined // TODO: Get from context store

    return this.complexityAnalyzer.analyzeComplexity(inputText, ideContext, conversationHistory)
  }

  private extractTextFromItems(items: Item[]): string {
    return items
      .filter(item => item.type === 'message' && 'content' in item)
      .map(item => {
        const message = item as any
        if (typeof message.content === 'string') {
          return message.content
        }
        if (Array.isArray(message.content)) {
          return message.content
            .filter(content => content.type === 'text')
            .map(content => content.text)
            .join(' ')
        }
        return ''
      })
      .join(' ')
  }

  private async selectModel(
    complexity: RequestComplexityAnalysis,
    requestedModel?: string
  ): Promise<string> {
    if (!this.config.modelIntelligence.enabled) {
      return requestedModel || this.config.model
    }

    // Use requested model as constraint if provided
    const constraints = requestedModel ? { preferredModel: requestedModel } : undefined

    return this.modelIntelligence.selectOptimalModel(complexity, constraints)
  }

  private async optimizeParameters(
    params: ResponseCreateParams,
    selectedModel: string,
    complexity: RequestComplexityAnalysis
  ): Promise<ResponseCreateParams> {
    if (!selectedModel.startsWith('gpt-5')) {
      return params // Only optimize GPT-5 parameters
    }

    const optimizedParams = await this.modelIntelligence.optimizeGPT5Parameters(
      complexity,
      params
    )

    return {
      ...params,
      ...optimizedParams
    }
  }

  private emitModelSelectionEvent(
    selectedModel: string,
    complexity: RequestComplexityAnalysis
  ): void {
    // Find the strategy used
    const strategy = this.config.modelIntelligence.routingStrategies.find(
      s => s.complexity === complexity.complexity
    )

    if (strategy) {
      this.emit('model_routing_event', {
        type: 'model_selection',
        data: {
          selectedModel,
          complexity,
          strategy
        }
      } as ModelRoutingEvent)
    }
  }

  private async executeWithIntelligence(
    params: ResponseCreateParams,
    selectedModel: string,
    startTime: number
  ): Promise<ResponseObject> {
    const actualParams = { ...params, model: selectedModel }

    // Add retry logic with exponential backoff
    const retryConfig = this.config.modelIntelligence.fallbackConfig.retryPolicy
    let lastError: Error | undefined

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        // Check circuit breaker before attempting
        const availability = await this.modelIntelligence.checkModelAvailability(selectedModel)
        if (!availability.isAvailable) {
          throw new Error(`Model ${selectedModel} is not available: circuit breaker is ${availability.circuitBreakerState}`)
        }

        const response = await this.baseClient.create(actualParams)

        // Record success for circuit breaker
        const circuitBreaker = (this.modelIntelligence as any).circuitBreakers?.get(selectedModel)
        circuitBreaker?.recordSuccess()

        return response

      } catch (error) {
        lastError = error as Error

        // Check if error is retryable
        const isRetryable = retryConfig.retryableErrors.some(errorCode =>
          lastError!.message.toLowerCase().includes(errorCode.toLowerCase())
        )

        if (!isRetryable || attempt === retryConfig.maxRetries) {
          throw lastError
        }

        // Calculate backoff delay
        const delay = Math.min(
          retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, attempt),
          retryConfig.maxDelay
        )

        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw lastError || new Error('Max retries exceeded')
  }

  private async handleRequestError(
    params: ResponseCreateParams,
    error: Error,
    startTime: number
  ): Promise<ResponseObject> {
    const originalModel = params.model || this.config.model

    // Try to get fallback model
    const fallbackModel = await this.handleModelFailure(originalModel, error)

    // Emit fallback event
    this.emit('model_routing_event', {
      type: 'model_fallback',
      data: {
        fromModel: originalModel,
        toModel: fallbackModel,
        reason: error.message,
        circuitBreakerState: 'unknown' // Would be set by actual circuit breaker
      }
    } as ModelRoutingEvent)

    try {
      // Attempt with fallback model
      const fallbackParams = { ...params, model: fallbackModel }
      const response = await this.baseClient.create(fallbackParams)

      await this.recordRequestMetrics(fallbackModel, startTime, response, undefined, true)

      return response

    } catch (fallbackError) {
      // Record both failures
      await this.recordRequestMetrics(originalModel, startTime, undefined, undefined, false, error.message)
      await this.recordRequestMetrics(fallbackModel, startTime, undefined, undefined, false, (fallbackError as Error).message)

      throw fallbackError
    }
  }

  private async handleModelFailure(modelName: string, error: Error): Promise<string> {
    return this.modelIntelligence.handleModelFailure(modelName, error)
  }

  private async recordRequestMetrics(
    modelName: string,
    startTime: number,
    response?: ResponseObject,
    complexity?: RequestComplexityAnalysis,
    success: boolean = true,
    errorMessage?: string
  ): Promise<void> {
    const latency = Date.now() - startTime

    // Get current metrics
    const currentMetrics = await this.modelIntelligence.getModelMetrics(modelName) || {
      modelName,
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
      totalLatency: 0,
      averageLatency: 0,
      totalTokens: { input: 0, output: 0, total: 0 },
      totalCost: 0,
      averageCostPerToken: 0,
      qualityScores: [],
      averageQualityScore: 0,
      lastUpdated: new Date(),
    }

    // Calculate cost if response available
    let cost = 0
    if (response?.usage) {
      cost = await this.modelIntelligence.estimateRequestCost(
        modelName,
        response.usage.input_tokens || 0,
        response.usage.output_tokens || 0
      )
    }

    // Update metrics
    const updatedMetrics: Partial<ModelMetrics> = {
      requestCount: currentMetrics.requestCount + 1,
      successCount: success ? currentMetrics.successCount + 1 : currentMetrics.successCount,
      errorCount: success ? currentMetrics.errorCount : currentMetrics.errorCount + 1,
      totalLatency: currentMetrics.totalLatency + latency,
      totalTokens: response?.usage ? {
        input: currentMetrics.totalTokens.input + (response.usage.input_tokens || 0),
        output: currentMetrics.totalTokens.output + (response.usage.output_tokens || 0),
        total: currentMetrics.totalTokens.total + (response.usage.total_tokens || 0),
      } : currentMetrics.totalTokens,
      totalCost: currentMetrics.totalCost + cost,
    }

    await this.modelIntelligence.recordModelMetrics(modelName, updatedMetrics)

    // Add to request history
    this.requestHistory.push({
      input: '', // Would store actual input in production
      model: modelName,
      complexity: complexity || { complexity: 'moderate', factors: {
        hasToolCalls: false,
        requiresReasoning: false,
        contentLength: 0,
        previousContext: 0,
        domainSpecific: false,
        multiStep: false
      }, confidence: 0.5, suggestedModel: modelName, reasoning: 'unknown' },
      timestamp: new Date(),
      latency,
      tokens: response?.usage,
      success,
      error: errorMessage
    })

    // Emit performance update event
    this.emit('model_routing_event', {
      type: 'performance_update',
      data: {
        modelName,
        metrics: updatedMetrics
      }
    } as ModelRoutingEvent)
  }

  // Additional utility methods
  async getModelMetrics(modelName?: string): Promise<ModelMetrics[]> {
    if (modelName) {
      const metrics = await this.modelIntelligence.getModelMetrics(modelName)
      return metrics ? [metrics] : []
    }
    return this.modelIntelligence.getAllModelMetrics()
  }

  async getSystemStatus(): Promise<{
    modelsAvailable: number
    totalRequests: number
    totalCost: number
    averageLatency: number
    requestHistory: Array<{ model: string; timestamp: Date; success: boolean }>
  }> {
    const systemStatus = await this.modelIntelligence.getSystemStatus()

    return {
      ...systemStatus,
      requestHistory: this.requestHistory.slice(-50).map(req => ({
        model: req.model,
        timestamp: req.timestamp,
        success: req.success
      }))
    }
  }

  async performHealthCheck(): Promise<{ healthy: boolean; issues: string[] }> {
    return this.modelIntelligence.performHealthCheck()
  }

  async resetCircuitBreaker(modelName: string): Promise<void> {
    await this.modelIntelligence.resetCircuitBreaker(modelName)
  }
}