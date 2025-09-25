// Real OpenAI Responses API types - based on official documentation
// https://platform.openai.com/docs/api-reference/responses/

export namespace ResponsesAPI {
  // Main response structure
  export interface Response {
    id: string
    object: 'response'
    created_at: number
    status: 'completed' | 'failed' | 'in_progress' | 'cancelled' | 'queued' | 'incomplete'
    error: ResponseError | null
    incomplete_details: IncompleteDetails | null
    instructions: string | string[] | null
    max_output_tokens: number | null
    model: string
    output: Item[]
    output_text?: string // SDK-only convenience property
    parallel_tool_calls: boolean
    previous_response_id: string | null
    reasoning: ReasoningConfig
    store: boolean
    temperature: number
    text: TextConfig
    tool_choice: ToolChoice
    tools: Tool[]
    top_p: number
    truncation: string
    usage: Usage
    metadata: Record<string, string>
  }

  // Response creation parameters
  export interface ResponseCreateParams {
    model: string
    input?: string | Item[]
    instructions?: string
    background?: boolean
    conversation?: string | ConversationObject
    include?: string[]
    max_output_tokens?: number
    max_tool_calls?: number
    metadata?: Record<string, string>
    parallel_tool_calls?: boolean
    previous_response_id?: string
    prompt?: PromptObject
    prompt_cache_key?: string
    reasoning?: ReasoningConfig
    safety_identifier?: string
    service_tier?: 'auto' | 'default' | 'flex' | 'priority'
    store?: boolean
    stream?: boolean
    stream_options?: StreamOptions
    temperature?: number
    text?: TextConfig
    tool_choice?: ToolChoice
    tools?: Tool[]
    top_logprobs?: number
    top_p?: number
    truncation?: 'auto' | 'disabled'
    user?: string // deprecated
  }

  // Items are the building blocks
  export type Item = MessageItem | FunctionCallItem | FunctionCallOutputItem | ReasoningItem

  export interface MessageItem {
    id: string
    type: 'message'
    role: 'assistant' | 'user' | 'system'
    status: 'completed' | 'in_progress' | 'incomplete'
    content: ContentBlock[]
  }

  export interface FunctionCallItem {
    id: string
    type: 'function_call'
    name: string
    arguments: string
    call_id: string
    status?: 'completed' | 'in_progress' | 'incomplete'
  }

  export interface FunctionCallOutputItem {
    type: 'function_call_output'
    call_id: string
    output: string
  }

  export interface ReasoningItem {
    id: string
    type: 'reasoning'
    content: any[]
    summary?: ReasoningSummary[]
  }

  export interface ContentBlock {
    type: 'input_text' | 'output_text' | 'input_image' | 'input_file'
    text?: string
    annotations?: any[]
    image_url?: ImageUrl
    file_id?: string
  }

  export interface ImageUrl {
    url: string
    detail?: 'auto' | 'low' | 'high'
  }

  export interface ReasoningSummary {
    content: string
  }

  // Tool definitions
  export type Tool = BuiltInTool | FunctionTool | CustomTool

  export interface BuiltInTool {
    type: 'web_search' | 'file_search' | 'code_interpreter' | 'computer_use'
  }

  export interface FunctionTool {
    type: 'function'
    function: {
      name: string
      description: string
      parameters: {
        type: 'object'
        properties: Record<string, any>
        required?: string[]
        additionalProperties?: boolean
      }
    }
  }

  export interface CustomTool {
    type: 'custom'
    name: string
    description: string
    parameters?: {
      type: 'object'
      properties: Record<string, any>
      required?: string[]
      additionalProperties?: boolean
    }
  }

  // Configuration objects
  export interface TextConfig {
    format?: {
      type: 'text' | 'json_schema'
      name?: string
      strict?: boolean
      schema?: any
    }
    verbosity?: 'low' | 'medium' | 'high'
  }

  export interface ReasoningConfig {
    effort?: 'minimal' | 'low' | 'medium' | 'high' | null
    summary?: 'auto' | null
  }

  export type ToolChoice = 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } }

  export interface ConversationObject {
    id: string
  }

  export interface PromptObject {
    id: string
    variables?: Record<string, any>
  }

  export interface StreamOptions {
    include_usage?: boolean
  }

  // Usage and error types
  export interface Usage {
    input_tokens: number
    input_tokens_details: {
      cached_tokens: number
    }
    output_tokens: number
    output_tokens_details: {
      reasoning_tokens: number
    }
    total_tokens: number
  }

  export interface ResponseError {
    type: string
    message: string
    code?: string
  }

  export interface IncompleteDetails {
    type: 'max_tokens' | 'tool_calls' | 'content_filter'
    reason?: string
  }

  // Stream events
  export type ResponseStreamEvent = {
    type: string
    data?: any
  }
}