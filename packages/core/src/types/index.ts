// Central export for all strongly-typed interfaces
// Use this to replace 'any' types across the codebase

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
  ResponseCreateParams
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
  ActiveExecution
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
