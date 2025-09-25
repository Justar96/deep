// OpenAI Responses API Client - using the real API
import { OpenAI } from 'openai'
import type { IResponseClient, DeepConfig } from './types.js'

export class OpenAIResponseClient implements IResponseClient {
  private client: OpenAI
  private config: DeepConfig

  constructor(client: OpenAI, config: DeepConfig) {
    this.client = client
    this.config = config
  }

  async create(params: any): Promise<any> {
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

  async *stream(params: any): AsyncIterable<any> {
    try {
      const enhancedParams = { ...this.enhanceParams(params), stream: true }
      
      if (this.config.logPaths) {
        console.log('[ResponseClient] Streaming parameters:', JSON.stringify(enhancedParams, null, 2))
      }
      
      // Use the real OpenAI Responses API streaming
      const stream = await this.client.responses.create(enhancedParams)
      
      for await (const event of stream) {
        if (this.config.logPaths) {
          console.log('[ResponseClient] Stream event type:', (event as any).type)
        }
        yield event
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`OpenAI Responses API streaming error: ${error.message}`)
      }
      throw error
    }
  }

  async followup(params: {
    input: any[]
    previousResponseId: string
    tools?: any[]
    maxOutputTokens?: number
  }): Promise<any> {
    const requestParams: any = {
      model: this.config.model,
      input: params.input,
      previous_response_id: params.previousResponseId,
      ...(params.tools && { tools: params.tools }),
      ...(params.maxOutputTokens && { max_output_tokens: params.maxOutputTokens }),
    }

    return this.create(requestParams)
  }

  private enhanceParams(params: any): any {
    const enhanced: any = {
      ...params,
      model: params.model || this.config.model,
      store: this.config.store,
    }

    // Add GPT-5 steering parameters
    if (!params.text) {
      enhanced.text = {
        verbosity: this.config.verbosity,
      }
    }

    if (!params.reasoning) {
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
  normalizeUsage(usage: any): { prompt_tokens: number; completion_tokens: number; total_tokens: number } {
    return {
      prompt_tokens: usage.input_tokens,
      completion_tokens: usage.output_tokens,
      total_tokens: usage.total_tokens,
    }
  }
}