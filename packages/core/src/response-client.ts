// OpenAI Responses API Client - using the real API
import { OpenAI } from 'openai'
import type { IResponseClient, DeepConfig } from './types.js'
import type { ResponseObject, ResponseCreateParams, Item } from './types/index.js'

export class OpenAIResponseClient implements IResponseClient {
  private client: OpenAI
  private config: DeepConfig

  constructor(client: OpenAI, config: DeepConfig) {
    this.client = client
    this.config = config
  }

  async create(params: ResponseCreateParams): Promise<ResponseObject> {
    try {
      const enhancedParams = this.enhanceParams(params)
      
      if (this.config.logPaths) {
        console.log('[ResponseClient] Parameters:', JSON.stringify(enhancedParams, null, 2))
      }
      
      // Use the real OpenAI Responses API
      const response = await this.client.responses.create(enhancedParams)
      
      if (this.config.logPaths) {
        console.log('[ResponseClient] Response ID:', response.id)
        console.log('[ResponseClient] Usage:', response.usage)
      }
      
      return response
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`OpenAI Responses API error: ${error.message}`)
      }
      throw error
    }
  }

  async *stream(params: ResponseCreateParams): AsyncIterable<ResponseObject> {
    try {
      const enhancedParams = { ...this.enhanceParams(params), stream: true }

      if (this.config.logPaths) {
        console.log('[ResponseClient] Streaming parameters:', JSON.stringify(enhancedParams, null, 2))
      }

      // Use the real OpenAI Responses API streaming
      const stream = await this.client.responses.create(enhancedParams)

      // For streaming responses, OpenAI SDK returns an async iterable
      // For non-streaming, it returns a Response object directly
      if (enhancedParams.stream && stream && typeof (stream as unknown as AsyncIterable<ResponseObject>)[Symbol.asyncIterator] === 'function') {
        for await (const event of stream as unknown as AsyncIterable<ResponseObject>) {
          if (this.config.logPaths) {
            console.log('[ResponseClient] Stream event type:', event.object)
          }
          yield event
        }
      } else {
        // Non-streaming response - yield the complete response
        if (this.config.logPaths) {
          console.log('[ResponseClient] Non-streaming response')
        }
        yield stream
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`OpenAI Responses API streaming error: ${error.message}`)
      }
      throw error
    }
  }

  async followup(params: {
    input: Item[]
    previousResponseId: string
    tools?: unknown[]
    maxOutputTokens?: number
  }): Promise<ResponseObject> {
    const requestParams: ResponseCreateParams = {
      model: this.config.model,
      input: params.input,
      previous_response_id: params.previousResponseId,
      ...(params.tools && { tools: params.tools }),
      ...(params.maxOutputTokens && { max_output_tokens: params.maxOutputTokens }),
    }

    return this.create(requestParams)
  }

  private enhanceParams(params: ResponseCreateParams): ResponseCreateParams {
    const enhanced: ResponseCreateParams = {
      ...params,
      model: params.model || this.config.model,
      store: this.config.store,
    }

    // Add GPT-5 steering parameters only for GPT-5 models
    const isGPT5Model = enhanced.model?.startsWith('gpt-5')

    if (!params.text && isGPT5Model) {
      enhanced.text = {
        verbosity: this.config.verbosity,
      }
    }

    if (!params.reasoning && isGPT5Model) {
      enhanced.reasoning = {
        effort: this.config.reasoningEffort,
      }
    }

    // Add summary if enabled
    if (this.config.enableSummary && enhanced.reasoning) {
      enhanced.reasoning.summary = 'auto'
    }

    // Add encrypted reasoning if enabled
    if (this.config.includeEncrypted) {
      enhanced.include = [...(enhanced.include || []), 'reasoning.encrypted_content']
      // Force store=false when using encrypted reasoning unless explicitly overridden
      if (typeof process !== 'undefined' && process.env?.OPENAI_RESP_STORE === undefined) {
        enhanced.store = false
      }
    }

    return enhanced
  }

  // Normalize usage from Responses format to Chat Completions format for backward compatibility
  normalizeUsage(usage: { input_tokens: number; output_tokens: number; total_tokens: number }): { prompt_tokens: number; completion_tokens: number; total_tokens: number } {
    return {
      prompt_tokens: usage.input_tokens,
      completion_tokens: usage.output_tokens,
      total_tokens: usage.total_tokens,
    }
  }
}