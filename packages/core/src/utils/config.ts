// Configuration management based on documented environment variables
import { z } from 'zod'
import type { DeepConfig } from '../types/core-types.js'
import { getEnv, getEnvOrDefault, getEnvBoolean, getEnvNumber, getEnvFloat } from '../types/env-types.js'

// Helper functions for optional environment variables
function getOptionalEnvNumber(key: string): number | undefined {
  const value = getEnv(key as any)
  if (value === undefined) return undefined
  const parsed = parseInt(value, 10)
  return isNaN(parsed) ? undefined : parsed
}

function getOptionalEnvFloat(key: string): number | undefined {
  const value = getEnv(key as any)
  if (value === undefined) return undefined
  const parsed = parseFloat(value)
  return isNaN(parsed) ? undefined : parsed
}

const ConversationCompressionSchema = z.object({
  enabled: z.boolean().default(true),
  threshold: z.number().min(0.1).max(1.0).default(0.7),
  strategy: z.enum(['summarize', 'truncate', 'selective']).default('summarize'),
  preserveContext: z.boolean().default(true),
  maxCompressionRatio: z.number().min(0.1).max(0.8).default(0.3),
})

const ConversationConfigSchema = z.object({
  compression: ConversationCompressionSchema,
  maxTokens: z.number().positive().default(8000),
  curationEnabled: z.boolean().default(true),
  healthCheckInterval: z.number().positive().default(30),
})

const ToolConfigSchema = z.object({
  confirmationEnabled: z.boolean().default(true),
  confirmationTimeoutMs: z.number().positive().default(30000),
  autoApprovalForLowRisk: z.boolean().default(true),
  auditTrailEnabled: z.boolean().default(true),
  sandboxingEnabled: z.boolean().default(false),
  emergencyStopEnabled: z.boolean().default(true),
  maxConcurrentExecutions: z.number().positive().default(5),
  executionTimeoutMs: z.number().positive().default(60000),
})

const ContextConfigSchema = z.object({
  enabled: z.boolean().default(true),
  updateStrategy: z.enum(['delta', 'full', 'smart']).default('smart'),
  compressionEnabled: z.boolean().default(true),
  compressionThreshold: z.number().positive().default(4000),
  maxContextSize: z.number().positive().default(8000),
  refreshIntervalMs: z.number().positive().default(30000),
  trackFileChanges: z.boolean().default(true),
  trackCursorPosition: z.boolean().default(true),
  trackGitState: z.boolean().default(true),
  relevanceThreshold: z.number().min(0).max(1).default(0.5),
})

const CircuitBreakerConfigSchema = z.object({
  failureThreshold: z.number().positive().default(5),
  successThreshold: z.number().positive().default(3),
  timeout: z.number().positive().default(60000),
  resetTimeout: z.number().positive().default(300000),
  monitoringWindow: z.number().positive().default(600000),
})

const ModelFallbackConfigSchema = z.object({
  enabled: z.boolean().default(true),
  circuitBreaker: CircuitBreakerConfigSchema,
  retryPolicy: z.object({
    maxRetries: z.number().min(0).default(3),
    backoffMultiplier: z.number().positive().default(2),
    baseDelay: z.number().positive().default(1000),
    maxDelay: z.number().positive().default(30000),
    retryableErrors: z.array(z.string()).default(['rate_limit_exceeded', 'server_error', 'timeout']),
  }),
  quotaManagement: z.object({
    enabled: z.boolean().default(true),
    dailyLimit: z.number().positive().optional(),
    hourlyLimit: z.number().positive().optional(),
    costLimit: z.number().positive().optional(),
    gracefulDegradation: z.boolean().default(true),
  }),
})

const GPT5OptimizationConfigSchema = z.object({
  reasoningEffortMapping: z.object({
    simple: z.enum(['minimal', 'low']).default('minimal'),
    moderate: z.enum(['low', 'medium']).default('low'),
    complex: z.enum(['medium', 'high']).default('medium'),
  }),
  verbosityMapping: z.object({
    simple: z.enum(['low', 'medium']).default('low'),
    moderate: z.enum(['medium']).default('medium'),
    complex: z.enum(['medium', 'high']).default('medium'),
  }),
  automaticOptimization: z.boolean().default(true),
  contextAwareParameters: z.boolean().default(true),
})

const ModelRoutingStrategySchema = z.object({
  complexity: z.enum(['simple', 'moderate', 'complex']),
  preferredModel: z.string(),
  fallbackModels: z.array(z.string()),
  costThreshold: z.number().positive().optional(),
  latencyThreshold: z.number().positive().optional(),
  qualityThreshold: z.number().min(0).max(1).optional(),
  conditions: z.object({
    maxTokens: z.number().positive().optional(),
    requiresReasoning: z.boolean().optional(),
    allowToolCalls: z.boolean().optional(),
    domainRestrictions: z.array(z.string()).optional(),
  }).optional(),
})

const ModelIntelligenceConfigSchema = z.object({
  enabled: z.boolean().default(true),
  routingStrategies: z.array(ModelRoutingStrategySchema).default([
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
  ]),
  defaultStrategy: z.string().default('moderate'),
  fallbackConfig: ModelFallbackConfigSchema,
  gpt5Optimization: GPT5OptimizationConfigSchema,
  performanceTracking: z.object({
    enabled: z.boolean().default(true),
    metricsRetentionDays: z.number().positive().default(30),
    qualityFeedbackEnabled: z.boolean().default(false),
    automaticModelSwitching: z.boolean().default(true),
  }),
  costOptimization: z.object({
    enabled: z.boolean().default(true),
    maxDailyCost: z.number().positive().default(100),
    preferCheaperModels: z.boolean().default(false),
    costThresholdForFallback: z.number().positive().default(0.1),
  }),
})

const ConfigSchema = z.object({
  apiKey: z.string().min(1, 'OPENAI_API_KEY is required'),
  baseUrl: z.string().url().optional().nullable(),
  model: z.string().default('gpt-5'),
  useResponsesDefault: z.boolean().default(true),
  stream: z.boolean().default(true),
  store: z.boolean().default(true),
  verbosity: z.enum(['low', 'medium', 'high']).default('medium'),
  reasoningEffort: z.enum(['minimal', 'low', 'medium', 'high']).default('medium'),
  enableSummary: z.boolean().default(false),
  includeEncrypted: z.boolean().default(false),
  allowedTools: z.array(z.string()).default([]),
  logPaths: z.boolean().default(false),
  conversation: ConversationConfigSchema,
  tools: ToolConfigSchema,
  context: ContextConfigSchema,
  modelIntelligence: ModelIntelligenceConfigSchema,
})

export function loadConfig(): DeepConfig {
  // Native env loading, support exactOptionalPropertyTypes
  const baseUrlValue = getEnv('OPENAI_BASE_URL')
  const baseUrl = (typeof baseUrlValue === 'string' && baseUrlValue.length > 0) ? baseUrlValue : null
  
  const config: DeepConfig = {
    apiKey: getEnvOrDefault('OPENAI_API_KEY', ''),
    model: getEnv('OPENAI_MODEL') || getEnv('OPENAI_DEFAULT_MODEL') || 'gpt-5',
    useResponsesDefault: getEnvBoolean('OPENAI_USE_RESPONSES_DEFAULT', true),
    stream: getEnvBoolean('OPENAI_STREAM', true),
    store: getEnvBoolean('OPENAI_RESP_STORE', true),
    verbosity: (getEnv('OPENAI_VERBOSITY') as DeepConfig['verbosity']) || 'medium',
    reasoningEffort: (getEnv('OPENAI_REASONING_EFFORT') as DeepConfig['reasoningEffort']) || 'medium',
    enableSummary: getEnvBoolean('OPENAI_RESP_ENABLE_SUMMARY', false),
    includeEncrypted: getEnvBoolean('OPENAI_RESP_INCLUDE_ENCRYPTED', false),
    allowedTools: getEnv('FIBER_ALLOWED_TOOLS')?.split(',').map(t => t.trim()) || [],
    logPaths: getEnvBoolean('OPENAI_LOG_PATHS', false),
    baseUrl,
    // Enhanced conversation management configuration
    conversation: {
      compression: {
        enabled: getEnvBoolean('DEEP_COMPRESSION_ENABLED', true),
        threshold: getEnvFloat('DEEP_COMPRESSION_THRESHOLD', 0.7),
        strategy: (getEnv('DEEP_COMPRESSION_STRATEGY') as 'summarize' | 'truncate' | 'selective') || 'summarize',
        preserveContext: getEnvBoolean('DEEP_COMPRESSION_PRESERVE_CONTEXT', true),
        maxCompressionRatio: getEnvFloat('DEEP_COMPRESSION_MAX_RATIO', 0.3),
      },
      maxTokens: getEnvNumber('DEEP_MAX_TOKENS', 8000),
      curationEnabled: getEnvBoolean('DEEP_CURATION_ENABLED', true),
      healthCheckInterval: getEnvNumber('DEEP_HEALTH_CHECK_INTERVAL', 30),
    },
    // Enhanced tool system configuration (Sprint 2)
    tools: {
      confirmationEnabled: getEnvBoolean('DEEP_TOOL_CONFIRMATION_ENABLED', true),
      confirmationTimeoutMs: getEnvNumber('DEEP_TOOL_CONFIRMATION_TIMEOUT_MS', 30000),
      autoApprovalForLowRisk: getEnvBoolean('DEEP_TOOL_AUTO_APPROVAL_LOW_RISK', true),
      auditTrailEnabled: getEnvBoolean('DEEP_TOOL_AUDIT_TRAIL_ENABLED', true),
      sandboxingEnabled: getEnvBoolean('DEEP_TOOL_SANDBOXING_ENABLED', false),
      emergencyStopEnabled: getEnvBoolean('DEEP_TOOL_EMERGENCY_STOP_ENABLED', true),
      maxConcurrentExecutions: getEnvNumber('DEEP_TOOL_MAX_CONCURRENT_EXECUTIONS', 5),
      executionTimeoutMs: getEnvNumber('DEEP_TOOL_EXECUTION_TIMEOUT_MS', 60000),
    },
    // IDE Context Integration configuration (Sprint 3)
    context: {
      enabled: getEnvBoolean('DEEP_CONTEXT_ENABLED', true),
      updateStrategy: (getEnv('DEEP_CONTEXT_UPDATE_STRATEGY') as 'delta' | 'full' | 'smart') || 'smart',
      compressionEnabled: getEnvBoolean('DEEP_CONTEXT_COMPRESSION_ENABLED', true),
      compressionThreshold: getEnvNumber('DEEP_CONTEXT_COMPRESSION_THRESHOLD', 4000),
      maxContextSize: getEnvNumber('DEEP_CONTEXT_MAX_SIZE', 8000),
      refreshIntervalMs: getEnvNumber('DEEP_CONTEXT_REFRESH_INTERVAL_MS', 30000),
      trackFileChanges: getEnvBoolean('DEEP_CONTEXT_TRACK_FILE_CHANGES', true),
      trackCursorPosition: getEnvBoolean('DEEP_CONTEXT_TRACK_CURSOR_POSITION', true),
      trackGitState: getEnvBoolean('DEEP_CONTEXT_TRACK_GIT_STATE', true),
      relevanceThreshold: getEnvFloat('DEEP_CONTEXT_RELEVANCE_THRESHOLD', 0.5),
    },
    // Model Intelligence & Routing configuration (Sprint 4)
    modelIntelligence: {
      enabled: getEnvBoolean('DEEP_MODEL_INTELLIGENCE_ENABLED', true),
      routingStrategies: [
        {
          complexity: 'simple' as const,
          preferredModel: getEnv('DEEP_MODEL_SIMPLE_PREFERRED') || 'gpt-5-mini',
          fallbackModels: getEnv('DEEP_MODEL_SIMPLE_FALLBACKS')?.split(',') || ['gpt-5-nano', 'gpt-4o'],
        },
        {
          complexity: 'moderate' as const,
          preferredModel: getEnv('DEEP_MODEL_MODERATE_PREFERRED') || 'gpt-5',
          fallbackModels: getEnv('DEEP_MODEL_MODERATE_FALLBACKS')?.split(',') || ['gpt-5-mini', 'gpt-4o'],
        },
        {
          complexity: 'complex' as const,
          preferredModel: getEnv('DEEP_MODEL_COMPLEX_PREFERRED') || 'gpt-5',
          fallbackModels: getEnv('DEEP_MODEL_COMPLEX_FALLBACKS')?.split(',') || ['gpt-4o'],
        },
      ],
      defaultStrategy: getEnv('DEEP_MODEL_DEFAULT_STRATEGY') || 'moderate',
      fallbackConfig: {
        enabled: getEnvBoolean('DEEP_MODEL_FALLBACK_ENABLED', true),
        circuitBreaker: {
          failureThreshold: getEnvNumber('DEEP_MODEL_CIRCUIT_BREAKER_FAILURE_THRESHOLD', 5),
          successThreshold: getEnvNumber('DEEP_MODEL_CIRCUIT_BREAKER_SUCCESS_THRESHOLD', 3),
          timeout: getEnvNumber('DEEP_MODEL_CIRCUIT_BREAKER_TIMEOUT', 60000),
          resetTimeout: getEnvNumber('DEEP_MODEL_CIRCUIT_BREAKER_RESET_TIMEOUT', 300000),
          monitoringWindow: getEnvNumber('DEEP_MODEL_CIRCUIT_BREAKER_MONITORING_WINDOW', 600000),
        },
        retryPolicy: {
          maxRetries: getEnvNumber('DEEP_MODEL_RETRY_MAX_RETRIES', 3),
          backoffMultiplier: getEnvFloat('DEEP_MODEL_RETRY_BACKOFF_MULTIPLIER', 2.0),
          baseDelay: getEnvNumber('DEEP_MODEL_RETRY_BASE_DELAY', 1000),
          maxDelay: getEnvNumber('DEEP_MODEL_RETRY_MAX_DELAY', 30000),
          retryableErrors: getEnv('DEEP_MODEL_RETRY_ERRORS')?.split(',') || ['rate_limit_exceeded', 'server_error', 'timeout'],
        },
        quotaManagement: {
          enabled: getEnvBoolean('DEEP_MODEL_QUOTA_ENABLED', true),
          dailyLimit: getOptionalEnvNumber('DEEP_MODEL_QUOTA_DAILY_LIMIT'),
          hourlyLimit: getOptionalEnvNumber('DEEP_MODEL_QUOTA_HOURLY_LIMIT'),
          costLimit: getOptionalEnvFloat('DEEP_MODEL_QUOTA_COST_LIMIT'),
          gracefulDegradation: getEnvBoolean('DEEP_MODEL_QUOTA_GRACEFUL_DEGRADATION', true),
        },
      },
      gpt5Optimization: {
        reasoningEffortMapping: {
          simple: (getEnv('DEEP_MODEL_GPT5_REASONING_SIMPLE') as 'minimal' | 'low') || 'minimal',
          moderate: (getEnv('DEEP_MODEL_GPT5_REASONING_MODERATE') as 'low' | 'medium') || 'low',
          complex: (getEnv('DEEP_MODEL_GPT5_REASONING_COMPLEX') as 'medium' | 'high') || 'medium',
        },
        verbosityMapping: {
          simple: (getEnv('DEEP_MODEL_GPT5_VERBOSITY_SIMPLE') as 'low' | 'medium') || 'low',
          moderate: 'medium' as const,
          complex: (getEnv('DEEP_MODEL_GPT5_VERBOSITY_COMPLEX') as 'medium' | 'high') || 'medium',
        },
        automaticOptimization: getEnvBoolean('DEEP_MODEL_GPT5_AUTO_OPTIMIZATION', true),
        contextAwareParameters: getEnvBoolean('DEEP_MODEL_GPT5_CONTEXT_AWARE_PARAMS', true),
      },
      performanceTracking: {
        enabled: getEnvBoolean('DEEP_MODEL_PERFORMANCE_TRACKING_ENABLED', true),
        metricsRetentionDays: getEnvNumber('DEEP_MODEL_METRICS_RETENTION_DAYS', 30),
        qualityFeedbackEnabled: getEnvBoolean('DEEP_MODEL_QUALITY_FEEDBACK_ENABLED', false),
        automaticModelSwitching: getEnvBoolean('DEEP_MODEL_AUTO_SWITCHING_ENABLED', true),
      },
      costOptimization: {
        enabled: getEnvBoolean('DEEP_MODEL_COST_OPTIMIZATION_ENABLED', true),
        maxDailyCost: getEnvFloat('DEEP_MODEL_MAX_DAILY_COST', 100),
        preferCheaperModels: getEnvBoolean('DEEP_MODEL_PREFER_CHEAPER_MODELS', false),
        costThresholdForFallback: getEnvFloat('DEEP_MODEL_COST_THRESHOLD_FALLBACK', 0.1),
      },
    },
  }
  // Override store default when encrypted is enabled
  if (config.includeEncrypted && getEnv('OPENAI_RESP_STORE') === undefined) {
    config.store = false
  }
  return ConfigSchema.parse(config)
}

export function validateConfig(config: DeepConfig): DeepConfig {
  return ConfigSchema.parse(config)
}
