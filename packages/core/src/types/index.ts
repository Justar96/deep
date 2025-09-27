// Central export for all strongly-typed interfaces
// Use this to replace 'any' types across the codebase

// Core types
export * from './core-types.js'
export type { OpenFile } from './core-types.js'

// Environment types and helpers
export type { ProcessEnv, TypedProcess } from './env-types.js'
export { getEnv, getEnvOrDefault, getEnvBoolean, getEnvNumber, getEnvFloat } from './env-types.js'

// OpenAI API types
export type {
  Usage,
  Role,
  ContentBlock,
  MessageItem,
  FunctionCallItem,
  FunctionCallOutputItem,
  ReasoningItem,
  Item,
  ToolChoice,
  ResponseObject,
  ResponseCreateParams,
  ResponseIncludable
} from './openai-types.js'

// Tool system types
export type {
  JSONSchema,
  FunctionTool,
  BuiltInTool,
  CustomTool,
  Tool,
  ToolExecutor,
  ToolEntry,
  ToolCallContext,
  ToolConfirmationRequest,
  ToolValidationResult,
  ToolAnalysisResult,
  ToolExecutionResult,
  ToolSecurityReport,
  ActiveExecution,
  EnhancedToolEntry
} from './tool-types.js'

// Type guards and validation utilities
export {
  isUsage,
  isContentBlock,
  isMessageItem,
  isFunctionCallItem,
  isFunctionCallOutputItem,
  isReasoningItem,
  isItem,
  isResponseObject,
  isFunctionTool,
  isBuiltInTool,
  isCustomTool,
  isTool,
  assertType,
  castType,
  ValidationError,
  validateItems
} from './type-guards.js'
