// Base Tool Registry - core tool management functionality
import type { IToolRegistry } from '../types/core-types.js'

export interface BaseToolEntry {
  definition: any
  executor: (input: string, callId: string) => Promise<string>
  trusted: boolean
}

export class BaseToolRegistry {
  protected tools: Map<string, BaseToolEntry> = new Map()

  constructor() {
    this.initializeDefaultTools()
  }

  getTools(trusted: boolean = true): any[] {
    const tools = Array.from(this.tools.values())
    return tools
      .filter(entry => entry.trusted === trusted || !trusted)
      .map(entry => entry.definition)
  }

  getAllTools(): BaseToolEntry[] {
    return Array.from(this.tools.values())
  }

  getToolEntry(name: string): BaseToolEntry | undefined {
    return this.tools.get(name)
  }

  async executeToolCall(name: string, input: string, callId: string): Promise<string> {
    const toolEntry = this.tools.get(name)
    if (!toolEntry) {
      throw new Error(`Tool not found: ${name}`)
    }

    try {
      return await toolEntry.executor(input, callId)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      return `Error executing ${name}: ${errorMsg}`
    }
  }

  async executeToolCallWithThrow(name: string, input: string, callId: string): Promise<string> {
    const toolEntry = this.tools.get(name)
    if (!toolEntry) {
      throw new Error(`Tool not found: ${name}`)
    }

    return await toolEntry.executor(input, callId)
  }

  registerTool(
    tool: any,
    executor: (input: string, callId: string) => Promise<string>,
    trusted: boolean = true
  ): void {
    if (!('name' in tool)) {
      throw new Error('Tool must have a name')
    }

    const toolEntry: BaseToolEntry = {
      definition: tool,
      executor,
      trusted
    }

    this.tools.set(tool.name, toolEntry)
  }

  hasToolEntry(name: string): boolean {
    return this.tools.has(name)
  }

  removeToolEntry(name: string): boolean {
    return this.tools.delete(name)
  }

  private initializeDefaultTools(): void {
    // Note: Native tools like web_search, file_search, code_interpreter are handled
    // directly by OpenAI and don't need custom executor functions in our registry.
    // We only register custom function tools that we implement ourselves.

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

// Compatibility wrapper that implements IToolRegistry for backward compatibility
export class BaseToolRegistryWrapper extends BaseToolRegistry implements IToolRegistry {
  // Stub methods for IToolRegistry compatibility
  async validateToolSchema(tool: any): Promise<boolean> {
    return true
  }

  async analyzeToolImpact(toolName: string, input: string): Promise<any> {
    return {
      filesAffected: [],
      operationType: 'read' as const,
      reversible: true,
      dataLossRisk: 'none' as const,
      systemImpact: 'none' as const,
      estimatedChangeScope: 0
    }
  }

  async requestApproval(confirmation: any): Promise<boolean> {
    return true
  }

  getAuditTrail(limit?: number): any[] {
    return []
  }

  async emergencyStop(): Promise<void> {
    // No-op for basic registry
  }
}