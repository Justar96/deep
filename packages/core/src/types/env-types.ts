// Environment variable types for proper TypeScript handling
// This helps resolve index signature access errors for process.env

export interface ProcessEnv {
  OPENAI_API_KEY?: string
  OPENAI_BASE_URL?: string
  OPENAI_MODEL?: string
  OPENAI_DEFAULT_MODEL?: string
  OPENAI_USE_RESPONSES_DEFAULT?: string
  OPENAI_STREAM?: string
  OPENAI_RESP_STORE?: string
  OPENAI_VERBOSITY?: string
  OPENAI_REASONING_EFFORT?: string
  OPENAI_RESP_ENABLE_SUMMARY?: string
  OPENAI_RESP_INCLUDE_ENCRYPTED?: string
  FIBER_ALLOWED_TOOLS?: string
  OPENAI_LOG_PATHS?: string
  DEEP_COMPRESSION_ENABLED?: string
  DEEP_COMPRESSION_THRESHOLD?: string
  DEEP_COMPRESSION_STRATEGY?: string
  DEEP_COMPRESSION_PRESERVE_CONTEXT?: string
  DEEP_COMPRESSION_MAX_RATIO?: string
  DEEP_MAX_TOKENS?: string
  DEEP_CURATION_ENABLED?: string
  DEEP_HEALTH_CHECK_INTERVAL?: string
  DEEP_TOOL_CONFIRMATION_ENABLED?: string
  DEEP_TOOL_CONFIRMATION_TIMEOUT_MS?: string
  DEEP_TOOL_AUTO_APPROVAL_LOW_RISK?: string
  DEEP_TOOL_AUDIT_TRAIL_ENABLED?: string
  DEEP_TOOL_SANDBOXING_ENABLED?: string
  DEEP_TOOL_EMERGENCY_STOP_ENABLED?: string
  DEEP_TOOL_MAX_CONCURRENT_EXECUTIONS?: string
  DEEP_TOOL_EXECUTION_TIMEOUT_MS?: string
  DEEP_CONTEXT_ENABLED?: string
  DEEP_CONTEXT_UPDATE_STRATEGY?: string
  DEEP_CONTEXT_COMPRESSION_ENABLED?: string
  DEEP_CONTEXT_COMPRESSION_THRESHOLD?: string
  DEEP_CONTEXT_MAX_SIZE?: string
  DEEP_CONTEXT_REFRESH_INTERVAL_MS?: string
  DEEP_CONTEXT_TRACK_FILE_CHANGES?: string
  DEEP_CONTEXT_TRACK_CURSOR_POSITION?: string
  DEEP_CONTEXT_TRACK_GIT_STATE?: string
  DEEP_CONTEXT_RELEVANCE_THRESHOLD?: string
  NODE_ENV?: string
  [key: string]: string | undefined
}

// Typed process interface
export interface TypedProcess {
  env: ProcessEnv
}

// Helper function to safely access environment variables
export function getEnv(key: keyof ProcessEnv): string | undefined {
  return (process.env as ProcessEnv)[key]
}

// Helper function to get environment variable with default
export function getEnvOrDefault(key: keyof ProcessEnv, defaultValue: string): string {
  return (process.env as ProcessEnv)[key] ?? defaultValue
}

// Helper function to get boolean environment variable
export function getEnvBoolean(key: keyof ProcessEnv, defaultValue = false): boolean {
  const value = (process.env as ProcessEnv)[key]
  if (value === undefined) return defaultValue
  return value !== 'false' && value !== '0'
}

// Helper function to get number environment variable
export function getEnvNumber(key: keyof ProcessEnv, defaultValue = 0): number {
  const value = (process.env as ProcessEnv)[key]
  if (value === undefined) return defaultValue
  const parsed = parseInt(value, 10)
  return isNaN(parsed) ? defaultValue : parsed
}

// Helper function to get float environment variable
export function getEnvFloat(key: keyof ProcessEnv, defaultValue = 0): number {
  const value = (process.env as ProcessEnv)[key]
  if (value === undefined) return defaultValue
  const parsed = parseFloat(value)
  return isNaN(parsed) ? defaultValue : parsed
}