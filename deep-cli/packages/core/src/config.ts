// Configuration management based on documented environment variables
import { z } from 'zod'
import type { DeepConfig } from './types.js'

const ConfigSchema = z.object({
  // Core API settings (OPENAI_API_KEY is required)
  apiKey: z.string().min(1, 'OPENAI_API_KEY is required'),
  baseUrl: z.string().url().optional(),
  model: z.string().default('gpt-5'),
  
  // Responses API behavior
  useResponsesDefault: z.boolean().default(true),
  stream: z.boolean().default(true),
  store: z.boolean().default(true),
  
  // GPT-5 steering parameters
  verbosity: z.enum(['low', 'medium', 'high']).default('medium'),
  reasoningEffort: z.enum(['minimal', 'low', 'medium', 'high']).default('medium'),
  
  // Advanced features
  enableSummary: z.boolean().default(false),
  includeEncrypted: z.boolean().default(false),
  
  // Tool access control
  allowedTools: z.array(z.string()).default([]),
  
  // Debugging
  logPaths: z.boolean().default(false),
})

export function loadConfig(): DeepConfig {
  const config = {
    // Core API settings
    apiKey: process.env.OPENAI_API_KEY || '',
    baseUrl: process.env.OPENAI_BASE_URL,
    model: process.env.OPENAI_MODEL || process.env.OPENAI_DEFAULT_MODEL || 'gpt-5',
    
    // Responses API behavior
    useResponsesDefault: process.env.OPENAI_USE_RESPONSES_DEFAULT === 'true',
    stream: process.env.OPENAI_STREAM !== 'false', // default true
    store: process.env.OPENAI_RESP_STORE !== 'false', // default true unless encrypted
    
    // GPT-5 steering parameters
    verbosity: (process.env.OPENAI_VERBOSITY as DeepConfig['verbosity']) || 'medium',
    reasoningEffort: (process.env.OPENAI_REASONING_EFFORT as DeepConfig['reasoningEffort']) || 'medium',
    
    // Advanced features
    enableSummary: process.env.OPENAI_RESP_ENABLE_SUMMARY === 'true',
    includeEncrypted: process.env.OPENAI_RESP_INCLUDE_ENCRYPTED === 'true',
    
    // Tool access control
    allowedTools: process.env.FIBER_ALLOWED_TOOLS ? 
      process.env.FIBER_ALLOWED_TOOLS.split(',').map(t => t.trim()) : 
      [],
    
    // Debugging
    logPaths: process.env.OPENAI_LOG_PATHS === 'true',
  }
  
  // Override store default when encrypted is enabled
  if (config.includeEncrypted && process.env.OPENAI_RESP_STORE === undefined) {
    config.store = false
  }
  
  return ConfigSchema.parse(config)
}

export function validateConfig(config: Partial<DeepConfig>): DeepConfig {
  return ConfigSchema.parse(config)
}