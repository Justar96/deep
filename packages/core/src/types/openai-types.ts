// OpenAI Responses API types used across the project
// These refine/replace 'any' usages in client and engine layers

export interface Usage {
  input_tokens: number
  input_tokens_details?: {
    cached_tokens?: number
  }
  output_tokens: number
  output_tokens_details?: {
    reasoning_tokens?: number
  }
  total_tokens: number
}

export type Role = 'assistant' | 'user' | 'system'

export type ContentBlock =
  | { type: 'input_text'; text: string }
  | { type: 'output_text'; text: string }
  | { type: 'input_image'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } }
  | { type: 'input_file'; file_id: string }

export interface MessageItem {
  id: string
  type: 'message'
  role: Role
  status: 'completed' | 'in_progress' | 'incomplete'
  content: ContentBlock[]
}

export interface FunctionCallItem {
  id: string
  type: 'function_call'
  name: string
  arguments: string
  input?: string // Backward compatibility alias for arguments
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
  content: { type: string; [k: string]: unknown }[]
  summary?: { content: string }[]
}

export type Item = MessageItem | FunctionCallItem | FunctionCallOutputItem | ReasoningItem

export type ToolChoice =
  | 'auto'
  | 'none'
  | 'required'
  | { type: 'function'; function: { name: string } }

// Response includes for API parameters
export type ResponseIncludable = 'conversation' | 'messages' | 'files' | 'metadata' | 'usage' | 'output'

export interface ResponseObject {
  id: string
  object: 'response'
  created_at: number
  status: 'completed' | 'failed' | 'in_progress' | 'cancelled' | 'queued' | 'incomplete'
  error: { type: string; message: string; code?: string } | null
  incomplete_details: { type: 'max_tokens' | 'tool_calls' | 'content_filter'; reason?: string } | null
  instructions: string | string[] | null
  max_output_tokens: number | null
  model: string
  output: Item[]
  output_text?: string
  parallel_tool_calls: boolean
  previous_response_id: string | null
  reasoning: { effort?: 'minimal' | 'low' | 'medium' | 'high' | null; summary?: 'auto' | null }
  store: boolean
  temperature: number
  text?: { format?: { type: 'text' | 'json_schema'; name?: string; strict?: boolean; schema?: unknown }; verbosity?: 'low' | 'medium' | 'high' }
  tool_choice?: ToolChoice
  tools?: unknown[]
  top_p: number
  truncation: string | 'auto' | 'disabled'
  usage: Usage
  metadata: Record<string, string>
}

export interface ResponseCreateParams {
  model: string
  input?: string | Item[]
  instructions?: string
  background?: boolean
  conversation?: string | { id: string }
  include?: ResponseIncludable[]
  max_output_tokens?: number
  max_tool_calls?: number
  metadata?: Record<string, string>
  parallel_tool_calls?: boolean
  previous_response_id?: string
  prompt?: { id: string; variables?: Record<string, unknown> }
  prompt_cache_key?: string
  reasoning?: { effort?: 'minimal' | 'low' | 'medium' | 'high' | null; summary?: 'auto' | null }
  safety_identifier?: string
  service_tier?: 'auto' | 'default' | 'flex' | 'priority'
  store?: boolean
  stream?: boolean
  stream_options?: { include_usage?: boolean }
  temperature?: number
  text?: { format?: { type: 'text' | 'json_schema'; name?: string; strict?: boolean; schema?: unknown }; verbosity?: 'low' | 'medium' | 'high' }
  tool_choice?: ToolChoice
  tools?: unknown[]
  top_logprobs?: number
  top_p?: number
  truncation?: 'auto' | 'disabled'
  user?: string
}
