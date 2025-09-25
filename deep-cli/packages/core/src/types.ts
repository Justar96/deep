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

// Tool registry for managing available tools
export interface IToolRegistry {
  getTools(trusted: boolean): any[]
  executeToolCall(name: string, input: string, callId: string): Promise<string>
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