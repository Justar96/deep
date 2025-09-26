// Tool system types to replace 'any' in tool registries and execution
import type { ToolSchema, ToolPermissions, ToolImpactAnalysis, ToolConfirmation, ToolAuditEntry } from '../types.js'

export interface JSONSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'
  properties?: Record<string, JSONSchema>
  items?: JSONSchema
  required?: string[]
  additionalProperties?: boolean
  description?: string
  enum?: (string | number | boolean)[]
  const?: unknown
}

export interface FunctionTool {
  type: 'function'
  name: string
  function: {
    name: string
    description: string
    parameters: JSONSchema
  }
}

export interface BuiltInTool {
  type: 'web_search' | 'file_search' | 'code_interpreter' | 'computer_use'
}

export interface CustomTool {
  type: 'custom'
  name: string
  description: string
  parameters?: JSONSchema
}

export type Tool = FunctionTool | BuiltInTool | CustomTool

export interface ToolExecutor {
  (input: string, callId: string): Promise<string>
}

export interface ToolEntry {
  tool: Tool
  executor: ToolExecutor
  trusted: boolean
  schema: ToolSchema
}

// Tool execution context with precise types
export interface ToolCallContext {
  name: string
  arguments: string | Record<string, unknown>
  callId: string
  tool: Tool
  executor: ToolExecutor
}

// Enhanced tool confirmation with structured data
export interface ToolConfirmationRequest {
  id: string
  toolCall: ToolConfirmation
  requestTime: Date
  timeoutMs: number
  callback: (approved: boolean, reason?: string) => void
}

// Tool validation result
export interface ToolValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  schema: ToolSchema
}

// Tool impact analysis result
export interface ToolAnalysisResult {
  riskLevel: 'low' | 'medium' | 'high'
  impact: ToolImpactAnalysis
  requiresConfirmation: boolean
  autoApprovalAllowed: boolean
}

// Tool execution result
export interface ToolExecutionResult {
  success: boolean
  output: string
  error?: string
  executionTime: number
  auditEntry: ToolAuditEntry
}

// Security report for tool usage
export interface ToolSecurityReport {
  totalExecutions: number
  highRiskExecutions: number
  failedExecutions: number
  suspiciousPatterns: string[]
  recommendedActions: string[]
  lastAuditTime: Date
}

// Active tool execution tracking
export interface ActiveExecution {
  callId: string
  toolName: string
  startTime: Date
  timeoutMs: number
  status: 'running' | 'completed' | 'failed' | 'timeout'
  pid?: number
}