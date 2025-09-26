# TypeScript Type Architecture Guide

This document describes the type architecture of the Deep AI Agent project and provides guidelines for maintaining type safety.

## Overview

The Deep AI Agent uses a comprehensive TypeScript type system to ensure compile-time safety and excellent developer experience. We have eliminated over 30% of `any` types from the original codebase.

## Type Organization

### Directory Structure

```
packages/core/src/types/
├── index.ts          # Central export point
├── openai-types.ts   # OpenAI Responses API types
├── tool-types.ts     # Tool system types
└── type-guards.ts    # Runtime type validation
```

## Core Type Categories

### 1. OpenAI Responses API Types (`openai-types.ts`)

These types mirror the OpenAI Responses API structure:

```typescript
import type { ResponseObject, Item, Usage } from '@deep-agent/core'

// Usage example
function handleResponse(response: ResponseObject) {
  console.log(`Used ${response.usage.total_tokens} tokens`)
  
  for (const item of response.output) {
    if (item.type === 'message') {
      // TypeScript knows this is MessageItem
      console.log(item.content)
    }
  }
}
```

**Key Types:**
- `ResponseObject`: Complete API response
- `Item`: Union of message/function call/reasoning items  
- `Usage`: Token usage information
- `ContentBlock`: Message content blocks

### 2. Tool System Types (`tool-types.ts`)

Strongly typed tool execution and management:

```typescript
import type { Tool, ToolExecutor, ToolCallContext } from '@deep-agent/core'

// Tool definition with proper typing
const myTool: Tool = {
  type: 'function',
  name: 'calculate',
  function: {
    name: 'calculate',
    description: 'Performs calculations',
    parameters: {
      type: 'object',
      properties: {
        expression: { type: 'string' }
      },
      required: ['expression']
    }
  }
}
```

**Key Types:**
- `Tool`: Union of function/built-in/custom tools
- `ToolExecutor`: Function signature for tool execution
- `JSONSchema`: Proper JSON Schema validation
- `ToolSecurityReport`: Security analysis results

### 3. Type Guards (`type-guards.ts`)

Runtime type validation for external data:

```typescript
import { isResponseObject, assertType, ValidationError } from '@deep-agent/core'

// Safe API response handling
async function processApiResponse(data: unknown) {
  if (isResponseObject(data)) {
    // TypeScript knows data is ResponseObject
    return data.output
  }
  
  throw new ValidationError('Invalid API response format')
}

// Safe type assertion
const response = assertType(apiData, isResponseObject, 'Expected OpenAI response')
```

**Available Guards:**
- `isResponseObject()` - Validates complete API responses
- `isItem()` - Validates conversation items
- `isTool()` - Validates tool definitions
- `isUsage()` - Validates token usage data

## Best Practices

### 1. Use Specific Types Instead of `any`

❌ **Don't do this:**
```typescript
function processData(data: any): any {
  return data.someProperty
}
```

✅ **Do this:**
```typescript
function processResponse(response: ResponseObject): Item[] {
  return response.output
}
```

### 2. Validate External Data with Type Guards

❌ **Don't do this:**
```typescript
const response = apiCall() as ResponseObject
```

✅ **Do this:**
```typescript
const rawResponse = await apiCall()
const response = assertType(rawResponse, isResponseObject, 'Invalid API response')
```

### 3. Use Union Types for Flexible APIs

✅ **Good pattern:**
```typescript
type ProcessorInput = string | Item[] | ResponseObject

function processInput(input: ProcessorInput) {
  if (typeof input === 'string') {
    // Handle string input
  } else if (Array.isArray(input)) {
    // Handle Item array
  } else {
    // Handle ResponseObject
  }
}
```

### 4. Export Types from Central Location

All types are exported from `@deep-agent/core`:

```typescript
import type { 
  ResponseObject, 
  Tool, 
  Usage,
  isResponseObject 
} from '@deep-agent/core'
```

## Migration Guidelines

### Replacing `any` Types

1. **Identify the actual data structure**
2. **Find or create appropriate interface**
3. **Add type guards for runtime validation**
4. **Update function signatures**

**Example migration:**
```typescript
// Before
function handleEvent(event: any): any {
  return event.data
}

// After
function handleEvent(event: DeepEvent): DeepEvent['data'] {
  return event.data
}
```

### File Naming Conventions

- **Files**: Use kebab-case (e.g., `openai-types.ts`, `type-guards.ts`)
- **Types**: Use PascalCase (e.g., `ResponseObject`, `ToolExecutor`)
- **Functions**: Use camelCase (e.g., `isResponseObject`, `validateItems`)

## Type Safety Levels

### Level 1: Basic Type Safety
- No `any` types
- Proper function signatures
- Basic interface definitions

### Level 2: Runtime Validation  
- Type guards for external data
- Error handling with typed exceptions
- Validation at API boundaries

### Level 3: Advanced Type Safety
- Branded types for IDs
- Conditional types for complex logic
- Template literal types for string validation

## Common Patterns

### 1. Safe API Client Pattern

```typescript
class SafeApiClient {
  async create(params: ResponseCreateParams): Promise<ResponseObject> {
    const rawResponse = await this.apiCall(params)
    return assertType(rawResponse, isResponseObject, 'Invalid API response')
  }
}
```

### 2. Event Processing Pattern

```typescript
async function* processEvents(events: AsyncIterable<unknown>) {
  for await (const event of events) {
    if (isDeepEvent(event)) {
      yield event
    } else {
      console.warn('Received invalid event:', event)
    }
  }
}
```

### 3. Tool Registration Pattern

```typescript
class TypedToolRegistry {
  registerTool<T extends Tool>(
    tool: T, 
    executor: ToolExecutor
  ): void {
    if (!isTool(tool)) {
      throw new ValidationError('Invalid tool definition')
    }
    // Register tool safely
  }
}
```

## Testing Types

### Unit Testing Type Guards

```typescript
describe('Type Guards', () => {
  test('isResponseObject validates correct structure', () => {
    const validResponse = {
      id: 'resp-123',
      object: 'response',
      // ... other fields
    }
    
    expect(isResponseObject(validResponse)).toBe(true)
    expect(isResponseObject(null)).toBe(false)
    expect(isResponseObject({})).toBe(false)
  })
})
```

### Type-Level Testing with `tsd`

```typescript
import { expectType } from 'tsd'
import type { ResponseObject } from '@deep-agent/core'

// Ensure proper type inference
expectType<ResponseObject['usage']>(usage)
```

## IDE Configuration

### VS Code Settings

Add to `.vscode/settings.json`:
```json
{
  "typescript.preferences.strictFunctionTypes": true,
  "typescript.preferences.noImplicitAny": true,
  "typescript.suggest.autoImports": true
}
```

### ESLint Integration

The project uses strict ESLint rules to prevent `any` usage:
```json
{
  "@typescript-eslint/no-explicit-any": "error"
}
```

## Future Improvements

1. **Branded Types**: Add branded types for IDs to prevent mixing
2. **Zod Integration**: Consider Zod for schema validation
3. **Conditional Types**: Add more sophisticated type relationships
4. **Template Literals**: Type-safe string manipulation

## Troubleshooting

### Common Type Errors

1. **"Type 'any' is not assignable to..."**
   - Use proper type annotations
   - Add type guards for runtime validation

2. **"Property doesn't exist on type..."**
   - Use type guards to narrow union types
   - Check for optional properties with `?.`

3. **"Argument of type 'unknown'..."**
   - Add type guards before using external data
   - Use type assertions only when absolutely safe

---

*For questions about the type system, refer to this guide or ask the development team.*