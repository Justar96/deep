// Chat Completions to Responses API Adapter
// This allows us to use Chat Completions API today with Responses API interface
// Will be replaced with direct Responses API calls when available

import { OpenAI } from 'openai'
import type { ResponsesAPI } from './responses-api-types.js'
import type { DeepConfig } from './types.js'

export class ChatCompletionsAdapter {
  private client: OpenAI
  private config: DeepConfig

  constructor(client: OpenAI, config: DeepConfig) {
    this.client = client
    this.config = config
  }

  async create(params: ResponsesAPI.ResponseCreateParams): Promise<ResponsesAPI.Response> {
    // Convert Responses API params to Chat Completions format
    const messages = this.convertInputToMessages(params.input, params.instructions)
    
    const completion = await this.client.chat.completions.create({
      model: params.model,
      messages,
      tools: this.convertTools(params.tools),
      max_tokens: params.max_output_tokens || undefined,
      stream: false,
    })

    // Convert Chat Completions response to Responses API format
    return this.convertChatCompletionToResponse(completion)
  }

  async *stream(params: ResponsesAPI.ResponseCreateParams): AsyncIterable<ResponsesAPI.ResponseStreamEvent> {
    const messages = this.convertInputToMessages(params.input, params.instructions)
    
    const stream = await this.client.chat.completions.create({
      model: params.model,
      messages,
      tools: this.convertTools(params.tools),
      max_tokens: params.max_output_tokens || undefined,
      stream: true,
    })

    for await (const chunk of stream) {
      yield this.convertStreamChunkToEvent(chunk)
    }
  }

  private convertInputToMessages(
    input: string | ResponsesAPI.Item[], 
    instructions?: string
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []

    // Add system message if instructions provided
    if (instructions) {
      messages.push({ role: 'system', content: instructions })
    }

    if (typeof input === 'string') {
      messages.push({ role: 'user', content: input })
    } else {
      // Convert Items to messages
      for (const item of input) {
        if (item.type === 'message') {
          const content = item.content.map(c => c.text).join('')
          messages.push({ role: item.role as any, content })
        } else if (item.type === 'function_call') {
          messages.push({
            role: 'assistant',
            tool_calls: [{
              id: item.call_id,
              type: 'function',
              function: {
                name: item.name,
                arguments: item.input
              }
            }]
          })
        } else if (item.type === 'function_call_output') {
          messages.push({
            role: 'tool',
            tool_call_id: item.call_id,
            content: item.output
          })
        }
      }
    }

    return messages
  }

  private convertTools(tools?: ResponsesAPI.Tool[]): OpenAI.Chat.Completions.ChatCompletionTool[] | undefined {
    if (!tools) return undefined

    return tools.map(tool => {
      if (tool.type === 'function') {
        return {
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
          }
        }
      }
      
      // Built-in tools (web_search, etc.) are not available in Chat Completions
      // Return a placeholder function that explains this
      return {
        type: 'function',
        function: {
          name: tool.type,
          description: `${tool.type} (will be native in Responses API)`,
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' }
            }
          }
        }
      }
    }) as OpenAI.Chat.Completions.ChatCompletionTool[]
  }

  private convertChatCompletionToResponse(
    completion: OpenAI.Chat.Completions.ChatCompletion
  ): ResponsesAPI.Response {
    const message = completion.choices[0]?.message

    const output: ResponsesAPI.Item[] = []

    if (message?.content) {
      output.push({
        id: `msg_${completion.id}`,
        type: 'message',
        role: 'assistant',
        status: 'completed',
        content: [{
          type: 'output_text',
          text: message.content,
          annotations: [],
          logprobs: []
        }]
      })
    }

    if (message?.tool_calls) {
      for (const toolCall of message.tool_calls) {
        if (toolCall.type === 'function') {
          output.push({
            id: `func_${toolCall.id}`,
            type: 'function_call',
            name: toolCall.function.name,
            input: toolCall.function.arguments,
            call_id: toolCall.id
          })
        }
      }
    }

    return {
      id: completion.id,
      object: 'response',
      created_at: completion.created,
      model: completion.model,
      output,
      usage: {
        input_tokens: completion.usage?.prompt_tokens || 0,
        output_tokens: completion.usage?.completion_tokens || 0,
        total_tokens: completion.usage?.total_tokens || 0
      }
    }
  }

  private convertStreamChunkToEvent(
    chunk: OpenAI.Chat.Completions.ChatCompletionChunk
  ): ResponsesAPI.ResponseStreamEvent {
    const delta = chunk.choices[0]?.delta
    
    if (delta?.content) {
      return {
        type: 'content_delta',
        data: { text: delta.content }
      }
    }

    if (delta?.tool_calls) {
      return {
        type: 'tool_call',
        data: {
          name: delta.tool_calls[0]?.function?.name || '',
          input: delta.tool_calls[0]?.function?.arguments || '',
          callId: delta.tool_calls[0]?.id || ''
        }
      }
    }

    return {
      type: 'chunk',
      data: chunk
    }
  }
}