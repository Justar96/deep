// Model Intelligence implementation for Sprint 4: Dynamic model selection and optimization
import { EventEmitter } from 'events'
import type { OpenAI } from 'openai'
import { z } from 'zod'
import type {
  IModelIntelligence,
  RequestComplexityAnalysis,
  ModelRoutingStrategy,
  ModelMetrics,
  ModelAvailability,
  CircuitBreakerState,
  ModelIntelligenceConfig,
  DeepConfig,
  IDEContext
} from '../types/core-types.js'
import type { Item } from '../types/index.js'

// Circuit breaker implementation for model fallback
class CircuitBreaker extends EventEmitter {
  private state: CircuitBreakerState = 'closed'
  private failures = 0
  private successes = 0
  private lastFailureTime = 0
  private nextRetryTime = 0

  constructor(
    private modelName: string,
    private config: ModelIntelligenceConfig['fallbackConfig']['circuitBreaker']
  ) {
    super()
  }

  getState(): CircuitBreakerState {
    // Check if we should transition from open to half-open
    if (this.state === 'open' && Date.now() > this.nextRetryTime) {
      this.state = 'half-open'
      this.emit('state_change', { modelName: this.modelName, newState: 'half-open', reason: 'timeout_expired' })
    }
    return this.state
  }

  recordSuccess(): void {
    this.failures = 0
    this.successes++

    if (this.state === 'half-open' && this.successes >= this.config.successThreshold) {
      this.state = 'closed'
      this.successes = 0
      this.emit('state_change', { modelName: this.modelName, newState: 'closed', reason: 'success_threshold_reached' })
    }
  }

  recordFailure(): void {
    this.failures++
    this.lastFailureTime = Date.now()

    if (this.state === 'closed' && this.failures >= this.config.failureThreshold) {
      this.state = 'open'
      this.nextRetryTime = Date.now() + this.config.timeout
      this.emit('state_change', { modelName: this.modelName, newState: 'open', reason: 'failure_threshold_reached' })
    } else if (this.state === 'half-open') {
      this.state = 'open'
      this.nextRetryTime = Date.now() + this.config.timeout
      this.emit('state_change', { modelName: this.modelName, newState: 'open', reason: 'half_open_failure' })
    }
  }

  reset(): void {
    this.state = 'closed'
    this.failures = 0
    this.successes = 0
    this.lastFailureTime = 0
    this.nextRetryTime = 0
    this.emit('state_change', { modelName: this.modelName, newState: 'closed', reason: 'manual_reset' })
  }

  canExecute(): boolean {
    const currentState = this.getState()
    return currentState === 'closed' || currentState === 'half-open'
  }
}

// Main model intelligence implementation
export class ModelIntelligence implements IModelIntelligence {
  private metrics: Map<string, ModelMetrics> = new Map()
  private circuitBreakers: Map<string, CircuitBreaker> = new Map()
  private costTracker: { daily: number; hourly: number; lastReset: Date } = {
    daily: 0,
    hourly: 0,
    lastReset: new Date()
  }

  constructor(
    private config: ModelIntelligenceConfig,
    private openaiClient: OpenAI
  ) {
    this.initializeMetrics()
    this.setupCostTracking()
  }

  private initializeMetrics(): void {
    // Initialize metrics for all configured models
    const allModels = new Set<string>()

    for (const strategy of this.config.routingStrategies) {
      allModels.add(strategy.preferredModel)
      strategy.fallbackModels.forEach(model => allModels.add(model))
    }

    for (const modelName of allModels) {
      if (!this.metrics.has(modelName)) {
        this.metrics.set(modelName, {
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
        })
      }

      if (!this.circuitBreakers.has(modelName)) {
        const circuitBreaker = new CircuitBreaker(modelName, this.config.fallbackConfig.circuitBreaker)
        circuitBreaker.on('state_change', (data) => {
          // Emit circuit breaker state change events
          console.log(`Circuit breaker for ${modelName} changed to ${data.newState}: ${data.reason}`)
        })
        this.circuitBreakers.set(modelName, circuitBreaker)
      }
    }
  }

  private ensureCircuitBreakerExists(modelName: string): void {
    if (!this.circuitBreakers.has(modelName)) {
      const circuitBreaker = new CircuitBreaker(modelName, this.config.fallbackConfig.circuitBreaker)
      circuitBreaker.on('state_change', (data) => {
        // Emit circuit breaker state change events
        console.log(`Circuit breaker for ${modelName} changed to ${data.newState}: ${data.reason}`)
      })
      this.circuitBreakers.set(modelName, circuitBreaker)
    }

    // Also ensure metrics exist
    if (!this.metrics.has(modelName)) {
      this.metrics.set(modelName, {
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
      })
    }
  }

  private setupCostTracking(): void {
    // Reset cost tracking daily/hourly
    setInterval(() => {
      const now = new Date()
      const lastReset = this.costTracker.lastReset

      // Reset daily cost if it's a new day
      if (now.getDate() !== lastReset.getDate()) {
        this.costTracker.daily = 0
      }

      // Reset hourly cost if it's a new hour
      if (now.getHours() !== lastReset.getHours()) {
        this.costTracker.hourly = 0
      }

      this.costTracker.lastReset = now
    }, 60000) // Check every minute
  }

  async analyzeRequestComplexity(
    input: string,
    context?: IDEContext,
    conversationHistory?: Item[]
  ): Promise<RequestComplexityAnalysis> {
    const factors = {
      hasToolCalls: input.includes('tool') || input.includes('function') || input.includes('execute'),
      requiresReasoning: this.detectReasoningRequirement(input),
      contentLength: input.length,
      previousContext: conversationHistory?.length || 0,
      domainSpecific: this.detectDomainSpecificity(input, context),
      multiStep: this.detectMultiStepRequest(input),
    }

    // Calculate complexity based on factors
    let complexityScore = 0

    if (factors.hasToolCalls) complexityScore += 2
    if (factors.requiresReasoning) complexityScore += 2
    if (factors.contentLength > 1000) complexityScore += 1
    if (factors.previousContext > 10) complexityScore += 1
    if (factors.domainSpecific) complexityScore += 1
    if (factors.multiStep) complexityScore += 2

    let complexity: 'simple' | 'moderate' | 'complex'
    let confidence: number

    if (complexityScore <= 2) {
      complexity = 'simple'
      confidence = 0.9
    } else if (complexityScore <= 5) {
      complexity = 'moderate'
      confidence = 0.8
    } else {
      complexity = 'complex'
      confidence = 0.85
    }

    // Suggest model based on complexity
    const strategy = this.config.routingStrategies.find(s => s.complexity === complexity)
    const suggestedModel = strategy?.preferredModel || 'gpt-5'

    return {
      complexity,
      factors,
      confidence,
      suggestedModel,
      reasoning: `Complexity analysis: score=${complexityScore}, factors=${JSON.stringify(factors)}`
    }
  }

  private detectReasoningRequirement(input: string): boolean {
    const reasoningKeywords = [
      'analyze', 'explain', 'why', 'how', 'compare', 'evaluate',
      'reasoning', 'logic', 'think', 'solve', 'plan', 'strategy'
    ]
    const lowerInput = input.toLowerCase()
    return reasoningKeywords.some(keyword => lowerInput.includes(keyword))
  }

  private detectDomainSpecificity(input: string, context?: IDEContext): boolean {
    if (!context) return false

    const technicalTerms = [
      'algorithm', 'database', 'api', 'framework', 'library',
      'typescript', 'javascript', 'python', 'rust', 'go'
    ]
    const lowerInput = input.toLowerCase()
    return technicalTerms.some(term => lowerInput.includes(term)) ||
           context.workspaceSettings.projectType !== 'other'
  }

  private detectMultiStepRequest(input: string): boolean {
    const multiStepIndicators = [
      'first', 'then', 'next', 'after', 'finally', 'step',
      'and then', 'followed by', 'subsequently'
    ]
    const lowerInput = input.toLowerCase()
    return multiStepIndicators.some(indicator => lowerInput.includes(indicator)) ||
           input.split('.').length > 3
  }

  async selectOptimalModel(
    complexity: RequestComplexityAnalysis,
    constraints?: Partial<ModelRoutingStrategy>
  ): Promise<string> {
    if (!this.config.enabled) {
      return this.config.routingStrategies[0]?.preferredModel || 'gpt-5'
    }

    // Find matching strategy
    let strategy = this.config.routingStrategies.find(s => s.complexity === complexity.complexity)

    if (!strategy) {
      // Fallback to default strategy
      const defaultStrategy = this.config.routingStrategies.find(s =>
        s.complexity === this.config.defaultStrategy
      )
      strategy = defaultStrategy || this.config.routingStrategies[0]
    }

    if (!strategy) {
      return 'gpt-5' // Ultimate fallback
    }

    // Apply constraints if provided
    if (constraints) {
      strategy = { ...strategy, ...constraints }
    }

    // Check model availability and circuit breaker
    const availability = await this.checkModelAvailability(strategy.preferredModel)

    if (availability.isAvailable && availability.circuitBreakerState !== 'open') {
      // Check cost constraints
      if (this.config.costOptimization.enabled && strategy.costThreshold) {
        const metrics = this.metrics.get(strategy.preferredModel)
        if (metrics && metrics.averageCostPerToken > strategy.costThreshold) {
          return this.selectFallbackModel(strategy)
        }
      }

      return strategy.preferredModel
    }

    // Use fallback model
    return this.selectFallbackModel(strategy)
  }

  private async selectFallbackModel(strategy: ModelRoutingStrategy): Promise<string> {
    for (const fallbackModel of strategy.fallbackModels) {
      const availability = await this.checkModelAvailability(fallbackModel)
      if (availability.isAvailable && availability.circuitBreakerState !== 'open') {
        return fallbackModel
      }
    }

    // Last resort: return first available model from all strategies
    for (const s of this.config.routingStrategies) {
      const availability = await this.checkModelAvailability(s.preferredModel)
      if (availability.isAvailable && availability.circuitBreakerState !== 'open') {
        return s.preferredModel
      }
    }

    return 'gpt-5' // Ultimate fallback
  }

  async recordModelMetrics(modelName: string, metrics: Partial<ModelMetrics>): Promise<void> {
    const existingMetrics = this.metrics.get(modelName) || {
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

    // Update metrics
    const updatedMetrics: ModelMetrics = {
      ...existingMetrics,
      ...metrics,
      lastUpdated: new Date(),
    }

    // Recalculate averages
    if (updatedMetrics.requestCount > 0) {
      updatedMetrics.averageLatency = updatedMetrics.totalLatency / updatedMetrics.requestCount
    }

    if (updatedMetrics.totalTokens.total > 0) {
      updatedMetrics.averageCostPerToken = updatedMetrics.totalCost / updatedMetrics.totalTokens.total
    }

    if (updatedMetrics.qualityScores.length > 0) {
      updatedMetrics.averageQualityScore =
        updatedMetrics.qualityScores.reduce((a, b) => a + b, 0) / updatedMetrics.qualityScores.length
    }

    this.metrics.set(modelName, updatedMetrics)

    // Update cost tracking
    if (metrics.totalCost) {
      this.costTracker.daily += metrics.totalCost
      this.costTracker.hourly += metrics.totalCost
    }
  }

  async getModelMetrics(modelName: string): Promise<ModelMetrics | null> {
    return this.metrics.get(modelName) || null
  }

  async getAllModelMetrics(): Promise<ModelMetrics[]> {
    return Array.from(this.metrics.values())
  }

  async checkModelAvailability(modelName: string): Promise<ModelAvailability> {
    // Ensure circuit breaker exists
    this.ensureCircuitBreakerExists(modelName)

    const circuitBreaker = this.circuitBreakers.get(modelName)
    const metrics = this.metrics.get(modelName)

    const circuitBreakerState = circuitBreaker?.getState() || 'closed'
    const availability: ModelAvailability = {
      modelName,
      isAvailable: circuitBreakerState !== 'open', // Available unless circuit breaker is open
      circuitBreakerState,
      healthScore: this.calculateHealthScore(metrics),
      estimatedLatency: metrics?.averageLatency || 1000,
      quotaStatus: {
        remaining: 1000, // Mock value - would be real quota in production
        nearLimit: false,
      }
    }

    // Check if circuit breaker allows execution
    if (circuitBreaker && !circuitBreaker.canExecute()) {
      availability.isAvailable = false
    }

    // Check quota limits
    if (this.config.fallbackConfig.quotaManagement.enabled) {
      const quotaConfig = this.config.fallbackConfig.quotaManagement

      if (quotaConfig.dailyLimit && this.costTracker.daily >= quotaConfig.dailyLimit) {
        availability.isAvailable = false
        availability.quotaStatus.nearLimit = true
      }

      if (quotaConfig.costLimit && this.costTracker.daily >= quotaConfig.costLimit) {
        availability.isAvailable = false
        availability.quotaStatus.nearLimit = true
      }
    }

    return availability
  }

  private calculateHealthScore(metrics?: ModelMetrics): number {
    if (!metrics || metrics.requestCount === 0) {
      return 1.0 // New models start with perfect health
    }

    const successRate = metrics.successCount / metrics.requestCount
    const latencyScore = Math.max(0, 1 - (metrics.averageLatency / 10000)) // Penalize high latency

    return (successRate * 0.7) + (latencyScore * 0.3)
  }

  async handleModelFailure(modelName: string, error: Error): Promise<string> {
    // Ensure circuit breaker exists
    this.ensureCircuitBreakerExists(modelName)

    // Record the failure
    const circuitBreaker = this.circuitBreakers.get(modelName)
    circuitBreaker?.recordFailure()

    // Update metrics
    const metrics = this.metrics.get(modelName)
    if (metrics) {
      await this.recordModelMetrics(modelName, {
        errorCount: metrics.errorCount + 1,
        requestCount: metrics.requestCount + 1,
      })
    }

    // Find fallback model - prefer more specific strategies (fewer fallbacks = more specific)
    const matchingStrategies = this.config.routingStrategies.filter(s => s.preferredModel === modelName)

    if (matchingStrategies.length > 0) {
      // Sort by specificity (fewer fallbacks = more specific)
      const sortedStrategies = matchingStrategies.sort((a, b) => a.fallbackModels.length - b.fallbackModels.length)
      return this.selectFallbackModel(sortedStrategies[0])
    }

    // Handle fallback models
    for (const strategy of this.config.routingStrategies) {
      if (strategy.fallbackModels.includes(modelName)) {
        // Find next fallback
        const currentIndex = strategy.fallbackModels.indexOf(modelName)
        for (let i = currentIndex + 1; i < strategy.fallbackModels.length; i++) {
          const nextFallback = strategy.fallbackModels[i]
          const availability = await this.checkModelAvailability(nextFallback)
          if (availability.isAvailable) {
            return nextFallback
          }
        }
        return strategy.preferredModel // Try preferred model as last resort
      }
    }

    return 'gpt-5' // Ultimate fallback
  }

  async resetCircuitBreaker(modelName: string): Promise<void> {
    const circuitBreaker = this.circuitBreakers.get(modelName)
    circuitBreaker?.reset()
  }

  async optimizeGPT5Parameters(
    complexity: RequestComplexityAnalysis,
    baseParams: object
  ): Promise<object> {
    if (!this.config.gpt5Optimization.automaticOptimization) {
      return baseParams
    }

    const optimizedParams = { ...baseParams }
    const optimization = this.config.gpt5Optimization

    // Apply reasoning effort optimization
    const reasoningEffort = optimization.reasoningEffortMapping[complexity.complexity]
    if (reasoningEffort) {
      (optimizedParams as any).reasoning = {
        effort: reasoningEffort
      }
    }

    // Apply verbosity optimization
    const verbosity = optimization.verbosityMapping[complexity.complexity]
    if (verbosity) {
      (optimizedParams as any).text = {
        verbosity: verbosity
      }
    }

    return optimizedParams
  }

  async estimateRequestCost(
    modelName: string,
    inputTokens: number,
    estimatedOutputTokens: number
  ): Promise<number> {
    // Model pricing (mock values - would be real pricing in production)
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-5': { input: 0.01, output: 0.03 },
      'gpt-5-mini': { input: 0.005, output: 0.015 },
      'gpt-5-nano': { input: 0.002, output: 0.008 },
      'gpt-4o': { input: 0.005, output: 0.015 },
    }

    const modelPricing = pricing[modelName] || pricing['gpt-5']
    return (inputTokens * modelPricing.input / 1000) + (estimatedOutputTokens * modelPricing.output / 1000)
  }

  async checkDailyCostLimit(): Promise<{ nearLimit: boolean; remaining: number }> {
    const limit = this.config.costOptimization.maxDailyCost
    const spent = this.costTracker.daily

    return {
      nearLimit: spent > (limit * 0.8), // 80% threshold
      remaining: Math.max(0, limit - spent)
    }
  }

  async performHealthCheck(): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = []

    // Check circuit breaker states
    for (const [modelName, circuitBreaker] of this.circuitBreakers) {
      if (circuitBreaker.getState() === 'open') {
        issues.push(`Circuit breaker for ${modelName} is open`)
      }
    }

    // Check cost limits
    const costCheck = await this.checkDailyCostLimit()
    if (costCheck.nearLimit) {
      issues.push('Approaching daily cost limit')
    }

    // Check model performance
    for (const metrics of this.metrics.values()) {
      const healthScore = this.calculateHealthScore(metrics)
      if (healthScore < 0.8) {
        issues.push(`Model ${metrics.modelName} has low health score: ${healthScore.toFixed(2)}`)
      }
    }

    return {
      healthy: issues.length === 0,
      issues
    }
  }

  async getSystemStatus(): Promise<{
    modelsAvailable: number;
    totalRequests: number;
    totalCost: number;
    averageLatency: number;
  }> {
    let modelsAvailable = 0
    let totalRequests = 0
    let totalCost = 0
    let totalLatency = 0
    let requestCount = 0

    for (const metrics of this.metrics.values()) {
      const availability = await this.checkModelAvailability(metrics.modelName)
      if (availability.isAvailable) {
        modelsAvailable++
      }

      totalRequests += metrics.requestCount
      totalCost += metrics.totalCost
      totalLatency += metrics.totalLatency
      requestCount += metrics.requestCount
    }

    return {
      modelsAvailable,
      totalRequests,
      totalCost,
      averageLatency: requestCount > 0 ? totalLatency / requestCount : 0
    }
  }
}