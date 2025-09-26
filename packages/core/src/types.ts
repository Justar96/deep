// Core types for the Deep agent using OpenAI Responses API
import type { OpenAI } from 'openai'

// Conversation metrics and token tracking
export interface ConversationMetrics {
  tokenUsage: {
    input: number
    output: number
    total: number
  }
  turnCount: number
  toolCallCount: number
  compressionEvents: number
  lastCompressionAt?: Date
}

// Conversation compression configuration
export interface ConversationCompression {
  enabled: boolean
  threshold: number // Token count threshold (default: 0.7 of max)
  strategy: 'summarize' | 'truncate' | 'selective'
  preserveContext: boolean
  maxCompressionRatio: number // Maximum compression ratio (default: 0.3)
}

// Smart split-point detection for preserving function call chains
export interface SplitPointAnalysis {
  splitIndex: number
  preservedItems: any[]
  compressibleItems: any[]
  reasoning: string
  confidence: number
}

// Conversation health and validation
export interface ConversationHealth {
  isValid: boolean
  hasInvalidResponses: boolean
  continuityScore: number
  issues: string[]
}

// Base configuration following the environment variable conventions
export interface DeepConfig {
  // Core API settings
  apiKey: string
  baseUrl?: string | null | undefined
  model: string

  // Responses API behavior
  useResponsesDefault: boolean
  stream: boolean
  store: boolean

  // GPT-5 steering parameters
  verbosity: 'low' | 'medium' | 'high'
  reasoningEffort: 'minimal' | 'low' | 'medium' | 'high'

  // Advanced features
  enableSummary: boolean
  includeEncrypted: boolean

  // Tool access control
  allowedTools: string[]

  // Debugging
  logPaths: boolean

  // New conversation management settings
  conversation: {
    compression: ConversationCompression
    maxTokens: number // Maximum tokens before compression
    curationEnabled: boolean
    healthCheckInterval: number // Minutes between health checks
  }

  // Enhanced tool system configuration (Sprint 2)
  tools: {
    confirmationEnabled: boolean
    confirmationTimeoutMs: number
    autoApprovalForLowRisk: boolean
    auditTrailEnabled: boolean
    sandboxingEnabled: boolean
    emergencyStopEnabled: boolean
    maxConcurrentExecutions: number
    executionTimeoutMs: number
  }
}

// Enhanced conversation state management
export interface ConversationState {
  id: string
  messages: any[] // Will be OpenAI response items
  lastResponseId?: string
  metadata: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
  // New advanced features
  metrics: ConversationMetrics
  compression: ConversationCompression
  health: ConversationHealth
  originalMessageCount?: number // Track compression history
}

// Turn execution context
export interface TurnContext {
  conversationId: string
  userInput: string
  previousResponseId?: string
  tools?: any[] // OpenAI tools
  maxOutputTokens?: number
}

// Streaming events for real-time UI updates
export type DeepEvent =
  | { type: 'turn_start'; data: { conversationId: string; input: string } }
  | { type: 'response_start'; data: { responseId: string } }
  | { type: 'content_delta'; data: { text: string } }
  | { type: 'tool_call'; data: { name: string; input: string; callId: string } }
  | { type: 'tool_result'; data: { callId: string; output: string } }
  | { type: 'reasoning_summary'; data: { summary: string } }
  | { type: 'turn_complete'; data: { usage: any; responseId: string } }
  | { type: 'error'; data: { error: string; code?: string } }
  // Enhanced Sprint 2 tool events
  | { type: 'tool_confirmation_request'; data: { confirmation: ToolConfirmation; timeoutMs: number } }
  | { type: 'tool_approved'; data: { callId: string; approvalSource: 'user' | 'auto' | 'policy' } }
  | { type: 'tool_denied'; data: { callId: string; reason: string } }
  | { type: 'tool_impact_analysis'; data: { callId: string; analysis: ToolImpactAnalysis } }
  | { type: 'tool_execution_start'; data: { callId: string; context: ToolExecutionContext } }
  | { type: 'tool_audit_log'; data: { entry: ToolAuditEntry } }
  | { type: 'emergency_stop'; data: { reason: string; affectedTools: string[] } }

// Agent engine interface
export interface IDeepEngine {
  processMessage(input: string, conversationId?: string): AsyncGenerator<DeepEvent>
  getConversation(id: string): Promise<ConversationState | null>
  listConversations(): Promise<ConversationState[]>
  clearConversation(id: string): Promise<void>
}

// Response client interface for normalized API access
export interface IResponseClient {
  create(params: any): Promise<any>
  stream(params: any): AsyncIterable<any>
  followup(params: {
    input: any[]
    previousResponseId: string
    tools?: any[]
    maxOutputTokens?: number
  }): Promise<any>
}

// Enhanced tool confirmation system (Sprint 2)
export interface ToolConfirmation {
  toolName: string
  riskLevel: 'low' | 'medium' | 'high'
  affectedPaths: string[]
  description: string
  requiresApproval: boolean
  impact: ToolImpactAnalysis
  reversible: boolean
}

// Tool execution context and sandboxing (Sprint 2)
export interface ToolExecutionContext {
  callId: string
  approved: boolean
  executionEnvironment: 'sandboxed' | 'direct'
  timeout: number
  affectedPaths: string[]
  permissions: ToolPermissions
  metadata: Record<string, unknown>
}

// Tool permissions and access control (Sprint 2)
export interface ToolPermissions {
  fileRead: boolean
  fileWrite: boolean
  fileDelete: boolean
  networkAccess: boolean
  systemExecution: boolean
  environmentAccess: boolean
}

// File system impact analysis (Sprint 2)
export interface ToolImpactAnalysis {
  filesAffected: string[]
  operationType: 'read' | 'write' | 'delete' | 'execute' | 'network'
  reversible: boolean
  dataLossRisk: 'none' | 'low' | 'high'
  systemImpact: 'none' | 'local' | 'global'
  estimatedChangeScope: number // Number of files/operations affected
}

// Tool schema validation (Sprint 2)
export interface ToolSchema {
  name: string
  version: string
  description: string
  parameters: any // JSON Schema for tool parameters
  returnType: any // JSON Schema for return value
  riskAssessment: ToolRiskAssessment
  permissions: ToolPermissions
}

// Risk assessment for tools (Sprint 2)
export interface ToolRiskAssessment {
  baseRiskLevel: 'low' | 'medium' | 'high'
  destructiveCapability: boolean
  dataAccessLevel: 'read-only' | 'read-write' | 'admin'
  requiresConfirmation: boolean
  autoApprovalAllowed: boolean
}

// Tool audit log entry (Sprint 2)
export interface ToolAuditEntry {
  id: string
  timestamp: Date
  toolName: string
  callId: string
  conversationId: string
  input: string
  output: string
  executionTime: number
  success: boolean
  error?: string | undefined
  riskLevel: 'low' | 'medium' | 'high'
  approved: boolean
  approvalSource: 'user' | 'auto' | 'policy'
  impactAnalysis: ToolImpactAnalysis
}

// Message bus for tool confirmations (Sprint 2)
export interface ToolConfirmationRequest {
  id: string
  toolCall: ToolConfirmation
  requestTime: Date
  timeoutMs: number
  callback: (approved: boolean, reason?: string) => void
}

// Tool registry interface for managing available tools
export interface IToolRegistry {
  getTools(trusted: boolean): any[]
  executeToolCall(name: string, input: string, callId: string): Promise<string>

  // Enhanced Sprint 2 methods
  validateToolSchema(tool: any): Promise<boolean>
  analyzeToolImpact(toolName: string, input: string): Promise<ToolImpactAnalysis>
  requestApproval(confirmation: ToolConfirmation): Promise<boolean>
  getAuditTrail(limit?: number): ToolAuditEntry[]
  emergencyStop(): Promise<void>
}

// Enhanced conversation manager for state persistence
export interface IConversationManager {
  get(id: string): Promise<ConversationState | null>
  create(id: string): Promise<ConversationState>
  update(id: string, items: any[], responseId?: string): Promise<void>
  list(): Promise<ConversationState[]>
  delete(id: string): Promise<void>
  // New compression and curation methods
  compressConversation(id: string, strategy?: ConversationCompression['strategy']): Promise<void>
  curateConversation(id: string): Promise<void>
  analyzeTokenUsage(messages: any[]): Promise<ConversationMetrics['tokenUsage']>
  findSplitPoint(messages: any[]): Promise<SplitPointAnalysis>
  validateConversationHealth(id: string): Promise<ConversationHealth>
}