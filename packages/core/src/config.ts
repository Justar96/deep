// Configuration management based on documented environment variables
import { z } from 'zod'
import type { DeepConfig } from './types.js'

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
})

export function loadConfig(): DeepConfig {
  // Native env loading, support exactOptionalPropertyTypes
  const baseUrl = (typeof process.env.OPENAI_BASE_URL === 'string' && process.env.OPENAI_BASE_URL.length > 0)
    ? process.env.OPENAI_BASE_URL
    : null
  const config: DeepConfig = {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || process.env.OPENAI_DEFAULT_MODEL || 'gpt-5',
    useResponsesDefault: process.env.OPENAI_USE_RESPONSES_DEFAULT !== 'false',
    stream: process.env.OPENAI_STREAM !== 'false',
    store: process.env.OPENAI_RESP_STORE !== 'false',
    verbosity: (process.env.OPENAI_VERBOSITY as DeepConfig['verbosity']) || 'medium',
    reasoningEffort: (process.env.OPENAI_REASONING_EFFORT as DeepConfig['reasoningEffort']) || 'medium',
    enableSummary: process.env.OPENAI_RESP_ENABLE_SUMMARY === 'true',
    includeEncrypted: process.env.OPENAI_RESP_INCLUDE_ENCRYPTED === 'true',
    allowedTools: process.env.FIBER_ALLOWED_TOOLS ? process.env.FIBER_ALLOWED_TOOLS.split(',').map(t => t.trim()) : [],
    logPaths: process.env.OPENAI_LOG_PATHS === 'true',
    baseUrl,
    // Enhanced conversation management configuration
    conversation: {
      compression: {
        enabled: process.env.DEEP_COMPRESSION_ENABLED !== 'false',
        threshold: parseFloat(process.env.DEEP_COMPRESSION_THRESHOLD || '0.7'),
        strategy: (process.env.DEEP_COMPRESSION_STRATEGY as 'summarize' | 'truncate' | 'selective') || 'summarize',
        preserveContext: process.env.DEEP_COMPRESSION_PRESERVE_CONTEXT !== 'false',
        maxCompressionRatio: parseFloat(process.env.DEEP_COMPRESSION_MAX_RATIO || '0.3'),
      },
      maxTokens: parseInt(process.env.DEEP_MAX_TOKENS || '8000', 10),
      curationEnabled: process.env.DEEP_CURATION_ENABLED !== 'false',
      healthCheckInterval: parseInt(process.env.DEEP_HEALTH_CHECK_INTERVAL || '30', 10),
    },
    // Enhanced tool system configuration (Sprint 2)
    tools: {
      confirmationEnabled: process.env.DEEP_TOOL_CONFIRMATION_ENABLED !== 'false',
      confirmationTimeoutMs: parseInt(process.env.DEEP_TOOL_CONFIRMATION_TIMEOUT_MS || '30000', 10),
      autoApprovalForLowRisk: process.env.DEEP_TOOL_AUTO_APPROVAL_LOW_RISK !== 'false',
      auditTrailEnabled: process.env.DEEP_TOOL_AUDIT_TRAIL_ENABLED !== 'false',
      sandboxingEnabled: process.env.DEEP_TOOL_SANDBOXING_ENABLED === 'true',
      emergencyStopEnabled: process.env.DEEP_TOOL_EMERGENCY_STOP_ENABLED !== 'false',
      maxConcurrentExecutions: parseInt(process.env.DEEP_TOOL_MAX_CONCURRENT_EXECUTIONS || '5', 10),
      executionTimeoutMs: parseInt(process.env.DEEP_TOOL_EXECUTION_TIMEOUT_MS || '60000', 10),
    },
    // IDE Context Integration configuration (Sprint 3)
    context: {
      enabled: process.env.DEEP_CONTEXT_ENABLED !== 'false',
      updateStrategy: (process.env.DEEP_CONTEXT_UPDATE_STRATEGY as 'delta' | 'full' | 'smart') || 'smart',
      compressionEnabled: process.env.DEEP_CONTEXT_COMPRESSION_ENABLED !== 'false',
      compressionThreshold: parseInt(process.env.DEEP_CONTEXT_COMPRESSION_THRESHOLD || '4000', 10),
      maxContextSize: parseInt(process.env.DEEP_CONTEXT_MAX_SIZE || '8000', 10),
      refreshIntervalMs: parseInt(process.env.DEEP_CONTEXT_REFRESH_INTERVAL_MS || '30000', 10),
      trackFileChanges: process.env.DEEP_CONTEXT_TRACK_FILE_CHANGES !== 'false',
      trackCursorPosition: process.env.DEEP_CONTEXT_TRACK_CURSOR_POSITION !== 'false',
      trackGitState: process.env.DEEP_CONTEXT_TRACK_GIT_STATE !== 'false',
      relevanceThreshold: parseFloat(process.env.DEEP_CONTEXT_RELEVANCE_THRESHOLD || '0.5'),
    },
  }
  // Override store default when encrypted is enabled
  if (config.includeEncrypted && process.env.OPENAI_RESP_STORE === undefined) {
    config.store = false
  }
  return ConfigSchema.parse(config)
}

export function validateConfig(config: DeepConfig): DeepConfig {
  return ConfigSchema.parse(config)
}
