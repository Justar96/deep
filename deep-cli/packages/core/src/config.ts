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
