// Turn - drives the agentic loop per user message
import { EventEmitter } from 'eventemitter3'
import type { 
  DeepEvent, 
  TurnContext, 
  IResponseClient, 
  IToolRegistry, 
  IConversationManager 
} from './types.js'

export class Turn extends EventEmitter<{ event: (event: DeepEvent) => void }> {
  private context: TurnContext
  private responseClient: IResponseClient
  private toolRegistry: IToolRegistry
  private conversationManager: IConversationManager

  constructor(
    context: TurnContext,
    responseClient: IResponseClient,
    toolRegistry: IToolRegistry,
    conversationManager: IConversationManager
  ) {
    super()
    this.context = context
    this.responseClient = responseClient
    this.toolRegistry = toolRegistry
    this.conversationManager = conversationManager
  }

  async *run(): AsyncGenerator<DeepEvent> {
    try {
      yield { type: 'turn_start', data: { 
        conversationId: this.context.conversationId, 
        input: this.context.userInput 
      } }

      // Get conversation state
      let conversation = await this.conversationManager.get(this.context.conversationId)
      if (!conversation) {
        conversation = await this.conversationManager.create(this.context.conversationId)
      }

      // Build input from conversation history and new user message
      const input: any[] = [
        ...conversation.messages,
        {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: this.context.userInput }],
        },
      ]

      // Initial request parameters
      let requestParams: any = {
        model: 'gpt-4o', // Will be overridden by client config
        input,
        tools: this.context.tools || this.toolRegistry.getTools(true),
        max_output_tokens: this.context.maxOutputTokens,
      }

      // Add previous response ID for continuity
      if (this.context.previousResponseId || conversation.lastResponseId) {
        requestParams.previous_response_id = this.context.previousResponseId || conversation.lastResponseId
      }

      let response = await this.responseClient.create(requestParams)
      
      yield { type: 'response_start', data: { responseId: response.id } }

      // Process the response items
      yield* this.processResponse(response, input)

      // Continue tool calling loop until no more tool calls
      while (this.hasToolCalls(response)) {
        const toolCallResults = await this.executeToolCalls(response)
        
        // Add tool results to input (don't add response.output as it already contains function calls)
        input.push(...toolCallResults)

        // Follow-up request with tool results
        response = await this.responseClient.followup({
          input,
          previousResponseId: response.id,
          tools: this.context.tools || this.toolRegistry.getTools(true),
          ...(this.context.maxOutputTokens && { maxOutputTokens: this.context.maxOutputTokens }),
        })

        yield* this.processResponse(response, input)
      }

      // Update conversation state
      await this.conversationManager.update(
        this.context.conversationId,
        input.slice(conversation.messages.length), // Only new items
        response.id
      )

      yield { 
        type: 'turn_complete', 
        data: { 
          usage: response.usage, 
          responseId: response.id 
        } 
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      yield { 
        type: 'error', 
        data: { 
          error: errorMsg,
          ...(error instanceof Error && 'code' in error && { code: error.code as string })
        } 
      }
    }
  }

  private async *processResponse(
    response: any,
    currentInput: any[]
  ): AsyncGenerator<DeepEvent> {
    for (const item of response.output) {
      switch (item.type) {
        case 'message':
          // Extract text content from OpenAI Responses API format
          for (const content of item.content || []) {
            if (content.type === 'output_text' || content.type === 'text') {
              yield {
                type: 'content_delta',
                data: { text: content.text }
              }
            }
          }
          break

        case 'function_call':
          yield {
            type: 'tool_call',
            data: {
              name: item.name,
              input: item.arguments || item.input,
              callId: item.call_id
            }
          }
          break

        case 'reasoning':
          // Handle reasoning items if summary is available
          if (item.summary && item.summary.length > 0) {
            const summaryText = item.summary.map((s: any) => s.content).join(' ')
            yield {
              type: 'reasoning_summary',
              data: { summary: summaryText }
            }
          }
          break
      }
    }
  }

  private hasToolCalls(response: any): boolean {
    return response.output.some((item: any) => item.type === 'function_call')
  }

  private async executeToolCalls(
    response: any
  ): Promise<any[]> {
    const toolResults: any[] = []

    for (const item of response.output) {
      if (item.type === 'function_call') {
        try {
          const result = await this.toolRegistry.executeToolCall(
            item.name,
            item.arguments || item.input,
            item.call_id
          )

          const toolResult: any = {
            type: 'function_call_output',
            call_id: item.call_id,
            output: result,
          }

          toolResults.push(toolResult)
          
          this.emit('event', { 
            type: 'tool_result', 
            data: { 
              callId: item.call_id, 
              output: result 
            } 
          })

        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Tool execution failed'
          
          const toolResult: any = {
            type: 'function_call_output',
            call_id: item.call_id,
            output: `Error: ${errorMsg}`,
          }

          toolResults.push(toolResult)
          
          this.emit('event', { 
            type: 'tool_result', 
            data: { 
              callId: item.call_id, 
              output: `Error: ${errorMsg}` 
            } 
          })
        }
      }
    }

    return toolResults
  }
}