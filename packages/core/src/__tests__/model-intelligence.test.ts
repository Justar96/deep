// Model Intelligence test suite
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OpenAI } from 'openai'
import { ModelIntelligence } from '../models/model-intelligence.js'
import { ComplexityAnalyzer } from '../models/complexity-analyzer.js'
import { IntelligentResponseClient } from '../models/intelligent-response-client.js'
import type {
  ModelIntelligenceConfig,
  DeepConfig,
  RequestComplexityAnalysis,
  ModelMetrics
} from '../types/core-types.js'

// Mock OpenAI client
vi.mock('openai')

describe('Model Intelligence System', () => {
  let mockOpenAI: vi.Mocked<OpenAI>
  let config: ModelIntelligenceConfig
  let fullConfig: DeepConfig
  let modelIntelligence: ModelIntelligence

  beforeEach(() => {
    mockOpenAI = {
      responses: {
        create: vi.fn(),
        stream: vi.fn(),
      },
    } as any

    config = {
      enabled: true,
      routingStrategies: [
        {
          complexity: 'simple',
          preferredModel: 'gpt-5-mini',
          fallbackModels: ['gpt-5-nano', 'gpt-4o'],
        },
        {
          complexity: 'moderate',
          preferredModel: 'gpt-5',
          fallbackModels: ['gpt-5-mini', 'gpt-4o'],
        },
        {
          complexity: 'complex',
          preferredModel: 'gpt-5',
          fallbackModels: ['gpt-4o'],
        },
      ],
      defaultStrategy: 'moderate',
      fallbackConfig: {
        enabled: true,
        circuitBreaker: {
          failureThreshold: 5,
          successThreshold: 3,
          timeout: 60000,
          resetTimeout: 300000,
          monitoringWindow: 600000,
        },
        retryPolicy: {
          maxRetries: 3,
          backoffMultiplier: 2,
          baseDelay: 1000,
          maxDelay: 30000,
          retryableErrors: ['rate_limit_exceeded', 'server_error', 'timeout'],
        },
        quotaManagement: {
          enabled: true,
          gracefulDegradation: true,
        },
      },
      gpt5Optimization: {
        reasoningEffortMapping: {
          simple: 'minimal',
          moderate: 'low',
          complex: 'medium',
        },
        verbosityMapping: {
          simple: 'low',
          moderate: 'medium',
          complex: 'medium',
        },
        automaticOptimization: true,
        contextAwareParameters: true,
      },
      performanceTracking: {
        enabled: true,
        metricsRetentionDays: 30,
        qualityFeedbackEnabled: false,
        automaticModelSwitching: true,
      },
      costOptimization: {
        enabled: true,
        maxDailyCost: 100,
        preferCheaperModels: false,
        costThresholdForFallback: 0.1,
      },
    }

    fullConfig = {
      apiKey: 'test-key',
      model: 'gpt-5',
      useResponsesDefault: true,
      stream: true,
      store: true,
      verbosity: 'medium',
      reasoningEffort: 'medium',
      enableSummary: false,
      includeEncrypted: false,
      allowedTools: [],
      logPaths: false,
      conversation: {
        compression: {
          enabled: true,
          threshold: 0.7,
          strategy: 'summarize',
          preserveContext: true,
          maxCompressionRatio: 0.3,
        },
        maxTokens: 8000,
        curationEnabled: true,
        healthCheckInterval: 30,
      },
      tools: {
        confirmationEnabled: true,
        confirmationTimeoutMs: 30000,
        autoApprovalForLowRisk: true,
        auditTrailEnabled: true,
        sandboxingEnabled: false,
        emergencyStopEnabled: true,
        maxConcurrentExecutions: 5,
        executionTimeoutMs: 60000,
      },
      context: {
        enabled: true,
        updateStrategy: 'smart',
        compressionEnabled: true,
        compressionThreshold: 4000,
        maxContextSize: 8000,
        refreshIntervalMs: 30000,
        trackFileChanges: true,
        trackCursorPosition: true,
        trackGitState: true,
        relevanceThreshold: 0.5,
      },
      modelIntelligence: config,
    }

    modelIntelligence = new ModelIntelligence(config, mockOpenAI)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('ComplexityAnalyzer', () => {
    let analyzer: ComplexityAnalyzer

    beforeEach(() => {
      analyzer = new ComplexityAnalyzer()
    })

    it('should analyze simple requests correctly', async () => {
      const input = 'Hello, how are you?'
      const analysis = await analyzer.analyzeComplexity(input)

      expect(analysis.complexity).toBe('simple')
      expect(analysis.factors.hasToolCalls).toBe(false)
      expect(analysis.factors.requiresReasoning).toBe(false)
      expect(analysis.factors.multiStep).toBe(false)
      expect(analysis.confidence).toBeGreaterThan(0.5)
    })

    it('should analyze complex tool-calling requests correctly', async () => {
      const input = 'Please analyze the codebase, find all TypeScript files, read their contents, and create a comprehensive report explaining the architecture and suggesting improvements.'
      const analysis = await analyzer.analyzeComplexity(input)

      expect(analysis.complexity).toBe('complex')
      expect(analysis.factors.hasToolCalls).toBe(true)
      expect(analysis.factors.requiresReasoning).toBe(true)
      expect(analysis.factors.multiStep).toBe(true)
      expect(analysis.factors.contentLength).toBeGreaterThan(100)
    })

    it('should analyze moderate reasoning requests correctly', async () => {
      const input = 'Can you explain how React hooks work and why they were introduced?'
      const analysis = await analyzer.analyzeComplexity(input)

      expect(analysis.complexity).toBe('moderate')
      expect(analysis.factors.requiresReasoning).toBe(true)
      expect(analysis.factors.hasToolCalls).toBe(false)
      expect(analysis.factors.domainSpecific).toBe(true)
    })

    it('should provide detailed analysis breakdown', async () => {
      const input = 'Create a new React component with TypeScript'
      const { analysis, breakdown } = await analyzer.getDetailedAnalysis(input)

      expect(breakdown.wordCount).toBeGreaterThan(0)
      expect(breakdown.technicalTerms).toContain('react')
      expect(breakdown.technicalTerms).toContain('typescript')
      expect(breakdown.actionVerbs).toContain('create')
    })
  })

  describe('ModelIntelligence', () => {
    it('should select optimal model based on complexity', async () => {
      const simpleComplexity: RequestComplexityAnalysis = {
        complexity: 'simple',
        factors: {
          hasToolCalls: false,
          requiresReasoning: false,
          contentLength: 50,
          previousContext: 0,
          domainSpecific: false,
          multiStep: false,
        },
        confidence: 0.9,
        suggestedModel: 'gpt-5-mini',
        reasoning: 'Simple request',
      }

      const selectedModel = await modelIntelligence.selectOptimalModel(simpleComplexity)
      expect(selectedModel).toBe('gpt-5-mini')
    })

    it('should handle model fallback correctly', async () => {
      const error = new Error('rate_limit_exceeded')
      const fallbackModel = await modelIntelligence.handleModelFailure('gpt-5', error)

      expect(fallbackModel).toBe('gpt-4o') // Should fallback from complex strategy
    })

    it('should track model metrics correctly', async () => {
      const modelName = 'gpt-5-mini'
      const metrics: Partial<ModelMetrics> = {
        requestCount: 5,
        successCount: 4,
        errorCount: 1,
        totalLatency: 2500,
        totalCost: 0.50,
        totalTokens: { input: 1000, output: 500, total: 1500 },
      }

      await modelIntelligence.recordModelMetrics(modelName, metrics)
      const retrievedMetrics = await modelIntelligence.getModelMetrics(modelName)

      expect(retrievedMetrics).toBeDefined()
      expect(retrievedMetrics!.requestCount).toBe(5)
      expect(retrievedMetrics!.averageLatency).toBe(500) // 2500 / 5
    })

    it('should optimize GPT-5 parameters based on complexity', async () => {
      const complexComplexity: RequestComplexityAnalysis = {
        complexity: 'complex',
        factors: {
          hasToolCalls: true,
          requiresReasoning: true,
          contentLength: 1000,
          previousContext: 10,
          domainSpecific: true,
          multiStep: true,
        },
        confidence: 0.85,
        suggestedModel: 'gpt-5',
        reasoning: 'Complex multi-step request',
      }

      const baseParams = { model: 'gpt-5', input: 'test' }
      const optimizedParams = await modelIntelligence.optimizeGPT5Parameters(
        complexComplexity,
        baseParams
      )

      expect(optimizedParams).toHaveProperty('reasoning')
      expect((optimizedParams as any).reasoning.effort).toBe('medium')
      expect(optimizedParams).toHaveProperty('text')
      expect((optimizedParams as any).text.verbosity).toBe('medium')
    })

    it('should check model availability and circuit breaker state', async () => {
      const availability = await modelIntelligence.checkModelAvailability('gpt-5')

      expect(availability).toHaveProperty('modelName', 'gpt-5')
      expect(availability).toHaveProperty('isAvailable')
      expect(availability).toHaveProperty('circuitBreakerState')
      expect(availability).toHaveProperty('healthScore')
      expect(availability.healthScore).toBeGreaterThanOrEqual(0)
      expect(availability.healthScore).toBeLessThanOrEqual(1)
    })

    it('should estimate request costs correctly', async () => {
      const cost = await modelIntelligence.estimateRequestCost('gpt-5', 1000, 500)

      expect(cost).toBeGreaterThan(0)
      expect(typeof cost).toBe('number')
    })

    it('should perform health checks', async () => {
      const health = await modelIntelligence.performHealthCheck()

      expect(health).toHaveProperty('healthy')
      expect(health).toHaveProperty('issues')
      expect(Array.isArray(health.issues)).toBe(true)
    })

    it('should get system status', async () => {
      const status = await modelIntelligence.getSystemStatus()

      expect(status).toHaveProperty('modelsAvailable')
      expect(status).toHaveProperty('totalRequests')
      expect(status).toHaveProperty('totalCost')
      expect(status).toHaveProperty('averageLatency')
      expect(typeof status.modelsAvailable).toBe('number')
    })
  })

  describe('IntelligentResponseClient', () => {
    let intelligentClient: IntelligentResponseClient

    beforeEach(() => {
      intelligentClient = new IntelligentResponseClient(mockOpenAI, fullConfig)
    })

    it('should create response with model intelligence', async () => {
      const mockResponse = {
        id: 'test-response',
        output_text: 'Test response',
        usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
      }

      mockOpenAI.responses.create.mockResolvedValue(mockResponse as any)

      const params = {
        model: 'gpt-5',
        input: 'Test input',
      }

      const response = await intelligentClient.create(params)

      expect(response).toEqual(mockResponse)
      expect(mockOpenAI.responses.create).toHaveBeenCalled()
    })

    it('should handle errors with fallback logic', async () => {
      const error = new Error('rate_limit_exceeded')
      mockOpenAI.responses.create
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          id: 'fallback-response',
          output_text: 'Fallback response',
          usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
        } as any)

      const params = {
        model: 'gpt-5',
        input: 'Test input',
      }

      const response = await intelligentClient.create(params)

      expect(response.id).toBe('fallback-response')
      expect(mockOpenAI.responses.create).toHaveBeenCalledTimes(2)
    })

    it('should provide system status with request history', async () => {
      const status = await intelligentClient.getSystemStatus()

      expect(status).toHaveProperty('modelsAvailable')
      expect(status).toHaveProperty('requestHistory')
      expect(Array.isArray(status.requestHistory)).toBe(true)
    })
  })

  describe('Circuit Breaker', () => {
    it('should open circuit after failure threshold', async () => {
      const modelName = 'test-model'

      // Simulate multiple failures
      for (let i = 0; i < 6; i++) {
        await modelIntelligence.handleModelFailure(modelName, new Error('test error'))
      }

      const availability = await modelIntelligence.checkModelAvailability(modelName)
      expect(availability.circuitBreakerState).toBe('open')
      expect(availability.isAvailable).toBe(false)
    })

    it('should reset circuit breaker manually', async () => {
      const modelName = 'test-model'

      // Cause failures to open circuit
      for (let i = 0; i < 6; i++) {
        await modelIntelligence.handleModelFailure(modelName, new Error('test error'))
      }

      // Reset circuit breaker
      await modelIntelligence.resetCircuitBreaker(modelName)

      const availability = await modelIntelligence.checkModelAvailability(modelName)
      expect(availability.circuitBreakerState).toBe('closed')
    })
  })

  describe('Cost Management', () => {
    it('should track daily cost limits', async () => {
      const costCheck = await modelIntelligence.checkDailyCostLimit()

      expect(costCheck).toHaveProperty('nearLimit')
      expect(costCheck).toHaveProperty('remaining')
      expect(typeof costCheck.nearLimit).toBe('boolean')
      expect(typeof costCheck.remaining).toBe('number')
    })

    it('should calculate cost estimates', async () => {
      const cost = await modelIntelligence.estimateRequestCost('gpt-5', 1000, 500)

      expect(cost).toBeGreaterThan(0)
      expect(cost).toBeLessThan(1) // Should be reasonable for test data
    })
  })
})