// Configuration management based on documented environment variables
import { z } from 'zod'
import type { DeepConfig } from './types.js'

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
