// Tool Registry - manages available tools and execution
import type { IToolRegistry } from './types.js'

export class BasicToolRegistry implements IToolRegistry {
  private trustedTools: Map<string, any>
  private untrustedTools: Map<string, any>
  private executors: Map<string, (input: string, callId: string) => Promise<string>>

  constructor() {
    this.trustedTools = new Map()
    this.untrustedTools = new Map()
    this.executors = new Map()
    
    this.initializeDefaultTools()
  }

  getTools(trusted: boolean = true): any[] {
    const toolMap = trusted ? this.trustedTools : this.untrustedTools
    return Array.from(toolMap.values())
  }

  async executeToolCall(name: string, input: string, callId: string): Promise<string> {
    const executor = this.executors.get(name)
    if (!executor) {
      throw new Error(`Tool executor not found: ${name}`)
    }
    
    try {
      return await executor(input, callId)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      return `Error executing ${name}: ${errorMsg}`
    }
  }

  registerTool(
    tool: any,
    executor: (input: string, callId: string) => Promise<string>,
    trusted: boolean = true
  ): void {
    const toolMap = trusted ? this.trustedTools : this.untrustedTools
    
    if ('name' in tool) {
      toolMap.set(tool.name, tool)
      this.executors.set(tool.name, executor)
    }
  }

  private initializeDefaultTools(): void {
    // Web search tool (trusted)
    this.registerTool(
      { type: 'web_search' },
      async (input: string) => {
        // OpenAI handles web search natively in Responses API
        return `Web search executed: ${input}`
      },
      true
    )

    // File search tool (trusted)
    this.registerTool(
      { type: 'file_search' },
      async (input: string) => {
        // OpenAI handles file search natively in Responses API
        return `File search executed: ${input}`
      },
      true
    )

    // Code interpreter tool (trusted)
    this.registerTool(
      { type: 'code_interpreter' },
      async (input: string) => {
        // OpenAI handles code interpreter natively in Responses API
        return `Code interpreter executed: ${input}`
      },
      true
    )

    // Custom function example
    this.registerTool(
      {
        type: 'function',
        name: 'get_current_time',
        description: 'Get the current time in ISO format',
        parameters: {
          type: 'object',
          properties: {
            timezone: {
              type: 'string',
              description: 'Timezone (e.g., UTC, America/New_York)',
            },
          },
          additionalProperties: false,
        },
      },
      async (input: string) => {
        const params = JSON.parse(input)
        const timezone = params.timezone || 'UTC'
        
        try {
          const date = new Date()
          const timeString = date.toLocaleString('en-US', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
          
          return `Current time in ${timezone}: ${timeString}`
        } catch (error) {
          return `Error getting time for timezone ${timezone}: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      },
      true
    )

    // Free-form custom tool example
    this.registerTool(
      {
        type: 'custom',
        name: 'echo_tool',
        description: 'Echoes back the input text with a prefix',
      },
      async (input: string) => {
        return `Echo: ${input}`
      },
      false // untrusted example
    )
  }
}