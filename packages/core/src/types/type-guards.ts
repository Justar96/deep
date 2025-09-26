// Type guards and validation utilities for runtime type safety
// Use these to safely validate API responses and user input

import type { 
  ResponseObject, 
  Item, 
  MessageItem, 
  FunctionCallItem, 
  FunctionCallOutputItem, 
  ReasoningItem,
  Usage,
  ContentBlock,
  Tool,
  FunctionTool,
  BuiltInTool,
  CustomTool
} from './index.js'

// Type guard for Usage object
export function isUsage(obj: unknown): obj is Usage {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as any).input_tokens === 'number' &&
    typeof (obj as any).output_tokens === 'number' &&
    typeof (obj as any).total_tokens === 'number'
  )
}

// Type guard for ContentBlock
export function isContentBlock(obj: unknown): obj is ContentBlock {
  if (typeof obj !== 'object' || obj === null) return false
  
  const block = obj as any
  const validTypes = ['input_text', 'output_text', 'input_image', 'input_file']
  
  if (!validTypes.includes(block.type)) return false
  
  switch (block.type) {
    case 'input_text':
    case 'output_text':
      return typeof block.text === 'string'
    case 'input_image':
      return (
        typeof block.image_url === 'object' &&
        typeof block.image_url.url === 'string'
      )
    case 'input_file':
      return typeof block.file_id === 'string'
    default:
      return false
  }
}

// Type guard for MessageItem
export function isMessageItem(obj: unknown): obj is MessageItem {
  if (typeof obj !== 'object' || obj === null) return false
  
  const item = obj as any
  return (
    typeof item.id === 'string' &&
    item.type === 'message' &&
    ['assistant', 'user', 'system'].includes(item.role) &&
    ['completed', 'in_progress', 'incomplete'].includes(item.status) &&
    Array.isArray(item.content) &&
    item.content.every(isContentBlock)
  )
}

// Type guard for FunctionCallItem
export function isFunctionCallItem(obj: unknown): obj is FunctionCallItem {
  if (typeof obj !== 'object' || obj === null) return false
  
  const item = obj as any
  return (
    typeof item.id === 'string' &&
    item.type === 'function_call' &&
    typeof item.name === 'string' &&
    typeof item.arguments === 'string' &&
    typeof item.call_id === 'string'
  )
}

// Type guard for FunctionCallOutputItem
export function isFunctionCallOutputItem(obj: unknown): obj is FunctionCallOutputItem {
  if (typeof obj !== 'object' || obj === null) return false
  
  const item = obj as any
  return (
    item.type === 'function_call_output' &&
    typeof item.call_id === 'string' &&
    typeof item.output === 'string'
  )
}

// Type guard for ReasoningItem
export function isReasoningItem(obj: unknown): obj is ReasoningItem {
  if (typeof obj !== 'object' || obj === null) return false
  
  const item = obj as any
  return (
    typeof item.id === 'string' &&
    item.type === 'reasoning' &&
    Array.isArray(item.content)
  )
}

// Type guard for Item (union type)
export function isItem(obj: unknown): obj is Item {
  return (
    isMessageItem(obj) ||
    isFunctionCallItem(obj) ||
    isFunctionCallOutputItem(obj) ||
    isReasoningItem(obj)
  )
}

// Type guard for ResponseObject
export function isResponseObject(obj: unknown): obj is ResponseObject {
  if (typeof obj !== 'object' || obj === null) return false
  
  const response = obj as any
  return (
    typeof response.id === 'string' &&
    response.object === 'response' &&
    typeof response.created_at === 'number' &&
    ['completed', 'failed', 'in_progress', 'cancelled', 'queued', 'incomplete'].includes(response.status) &&
    typeof response.model === 'string' &&
    Array.isArray(response.output) &&
    response.output.every(isItem) &&
    isUsage(response.usage)
  )
}

// Type guard for FunctionTool
export function isFunctionTool(obj: unknown): obj is FunctionTool {
  if (typeof obj !== 'object' || obj === null) return false
  
  const tool = obj as any
  return (
    tool.type === 'function' &&
    typeof tool.name === 'string' &&
    typeof tool.function === 'object' &&
    typeof tool.function.name === 'string' &&
    typeof tool.function.description === 'string' &&
    typeof tool.function.parameters === 'object'
  )
}

// Type guard for BuiltInTool
export function isBuiltInTool(obj: unknown): obj is BuiltInTool {
  if (typeof obj !== 'object' || obj === null) return false
  
  const tool = obj as any
  return ['web_search', 'file_search', 'code_interpreter', 'computer_use'].includes(tool.type)
}

// Type guard for CustomTool
export function isCustomTool(obj: unknown): obj is CustomTool {
  if (typeof obj !== 'object' || obj === null) return false
  
  const tool = obj as any
  return (
    tool.type === 'custom' &&
    typeof tool.name === 'string' &&
    typeof tool.description === 'string'
  )
}

// Type guard for Tool (union type)
export function isTool(obj: unknown): obj is Tool {
  return isFunctionTool(obj) || isBuiltInTool(obj) || isCustomTool(obj)
}

// Utility function for safe type assertion with error handling
export function assertType<T>(
  obj: unknown,
  guard: (obj: unknown) => obj is T,
  errorMessage?: string
): T {
  if (guard(obj)) {
    return obj
  }
  throw new TypeError(errorMessage || `Type assertion failed`)
}

// Utility function for safe type casting with fallback
export function castType<T>(
  obj: unknown,
  guard: (obj: unknown) => obj is T,
  fallback: T
): T {
  return guard(obj) ? obj : fallback
}

// Validation error class
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

// Validate array of items
export function validateItems(items: unknown[]): Item[] {
  const validItems: Item[] = []
  const errors: string[] = []
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (isItem(item)) {
      validItems.push(item)
    } else {
      errors.push(`Invalid item at index ${i}: ${JSON.stringify(item)}`)
    }
  }
  
  if (errors.length > 0) {
    throw new ValidationError(`Validation failed: ${errors.join(', ')}`)
  }
  
  return validItems
}