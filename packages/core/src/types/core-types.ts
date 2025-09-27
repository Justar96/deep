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
  preservedItems: import('./index.js').Item[]
  compressibleItems: import('./index.js').Item[]
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

  // IDE Context Integration configuration (Sprint 3)
  context: {
    enabled: boolean
    updateStrategy: 'delta' | 'full' | 'smart'
    compressionEnabled: boolean
    compressionThreshold: number // Token count for context compression
    maxContextSize: number // Maximum context tokens
    refreshIntervalMs: number // Auto-refresh interval
    trackFileChanges: boolean
    trackCursorPosition: boolean
    trackGitState: boolean
    relevanceThreshold: number // 0-1 score for context relevance filtering
  }

  // Model Intelligence & Routing configuration (Sprint 4)
  modelIntelligence: ModelIntelligenceConfig
}

// Enhanced conversation state management
export interface ConversationState {
  id: string
  messages: import('./index.js').Item[] // OpenAI response items
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
  tools?: import('./index.js').Tool[] // OpenAI tools
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
  | { type: 'turn_complete'; data: { usage: import('./index.js').Usage; responseId: string } }
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
  create(params: import('./index.js').ResponseCreateParams): Promise<import('./index.js').ResponseObject>
  stream(params: import('./index.js').ResponseCreateParams): AsyncIterable<import('./index.js').ResponseObject>
  followup(params: {
    input: import('./index.js').Item[]
    previousResponseId: string
    tools?: unknown[]
    maxOutputTokens?: number
  }): Promise<import('./index.js').ResponseObject>
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
  parameters: import('./index.js').JSONSchema // JSON Schema for tool parameters
  returnType: import('./index.js').JSONSchema // JSON Schema for return value
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
  getTools(trusted: boolean): import('./index.js').Tool[]
  executeToolCall(name: string, input: string, callId: string): Promise<string>

  // Enhanced Sprint 2 methods
  validateToolSchema(tool: import('./index.js').Tool): Promise<boolean>
  analyzeToolImpact(toolName: string, input: string): Promise<ToolImpactAnalysis>
  requestApproval(confirmation: ToolConfirmation): Promise<boolean>
  getAuditTrail(limit?: number): ToolAuditEntry[]
  emergencyStop(): Promise<void>
}

// Enhanced conversation manager for state persistence
export interface IConversationManager {
  get(id: string): Promise<ConversationState | null>
  create(id: string): Promise<ConversationState>
  update(id: string, items: import('./index.js').Item[], responseId?: string): Promise<void>
  list(): Promise<ConversationState[]>
  delete(id: string): Promise<void>
  // New compression and curation methods
  compressConversation(id: string, strategy?: ConversationCompression['strategy']): Promise<void>
  curateConversation(id: string): Promise<void>
  analyzeTokenUsage(messages: import('./index.js').Item[]): Promise<ConversationMetrics['tokenUsage']>
  findSplitPoint(messages: import('./index.js').Item[]): Promise<SplitPointAnalysis>
  validateConversationHealth(id: string): Promise<ConversationHealth>
}

// ================================
// Sprint 3: IDE Context Integration
// ================================

// Git state context for repository awareness
export interface GitContext {
  branch: string
  status: 'clean' | 'dirty' | 'unknown'
  recentCommits: GitCommit[]
  stagedFiles: string[]
  modifiedFiles: string[]
  untrackedFiles: string[]
  remoteUrl?: string
  lastUpdate: Date
}

// Git commit information
export interface GitCommit {
  hash: string
  message: string
  author: string
  date: Date
  filesChanged: string[]
}

// File change tracking for delta updates
export interface FileChange {
  filePath: string
  changeType: 'created' | 'modified' | 'deleted' | 'renamed'
  oldPath?: string // For renamed files
  timestamp: Date
  lineChanges?: {
    added: number
    removed: number
    modified: number
  }
  relevanceScore?: number // 0-1 score for context filtering
}

// Open file information for IDE context
export interface OpenFile {
  path: string
  timestamp: number
  isActive: boolean
  cursor?: {
    line: number
    character: number
  }
  selectedText?: string
}

// Core IDE context state
export interface IDEContext {
  activeFile?: string
  cursorPosition?: {
    line: number
    character: number
  }
  selectedText?: {
    content: string
    startLine: number
    endLine: number
    startColumn: number
    endColumn: number
  }
  openFiles: OpenFile[]
  projectRoot: string
  gitState: GitContext
  recentChanges: FileChange[]
  workspaceSettings: WorkspaceSettings
  languageServerInfo?: LanguageServerInfo
  lastUpdate: Date
  tokenCount: number // Estimated token count for this context
}

// Workspace configuration and settings
export interface WorkspaceSettings {
  extensions: string[]
  language: string
  formatter?: string
  linter?: string
  testFramework?: string | undefined
  buildCommand?: string
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'bun'
  projectType?: 'node' | 'react' | 'vue' | 'python' | 'rust' | 'go' | 'other'
}

// Language Server Protocol integration
export interface LanguageServerInfo {
  name: string
  version: string
  capabilities: string[]
  diagnostics: Diagnostic[]
  symbols: Symbol[]
  lastSync: Date
}

// Diagnostic information from LSP
export interface Diagnostic {
  filePath: string
  line: number
  column: number
  severity: 'error' | 'warning' | 'info' | 'hint'
  message: string
  source?: string
  code?: string | number
}

// Symbol information from LSP
export interface Symbol {
  name: string
  kind: string
  filePath: string
  line: number
  column: number
  containerName?: string
}

// Delta-based context updates for efficient token usage
export interface ContextDelta {
  added: Partial<IDEContext>
  removed: string[] // Keys that were removed
  modified: Partial<IDEContext>
  timestamp: Date
  tokenDelta: number // Change in token count
  reason: string // Reason for the update (file_change, cursor_move, etc.)
}

// Context relevance analysis for intelligent filtering
export interface ContextRelevance {
  filePath: string
  relevanceScore: number // 0-1 score
  factors: {
    recentlyModified: boolean
    currentlyOpen: boolean
    relatedToActiveFile: boolean
    containsErrors: boolean
    referencedInConversation: boolean
  }
  lastAccessed: Date
}

// Context compression for large codebases
export interface ContextCompression {
  enabled: boolean
  strategy: 'smart' | 'filter'
  threshold: number // Token threshold for compression
  preserveActive: boolean // Always preserve active file context
  maxRelevantFiles: number // Maximum number of files to include
}

// Context store interface for managing IDE state
export interface IContextStore {
  // Core context management
  getCurrentContext(): Promise<IDEContext>
  updateContext(delta: ContextDelta): Promise<void>
  setActiveFile(filePath: string): Promise<void>
  setCursorPosition(line: number, character: number): Promise<void>
  setSelectedText(content: string, start: {line: number, character: number}, end: {line: number, character: number}): Promise<void>

  // File and project tracking
  addOpenFile(filePath: string): Promise<void>
  removeOpenFile(filePath: string): Promise<void>
  trackFileChange(change: FileChange): Promise<void>
  refreshProjectStructure(): Promise<void>

  // Git integration
  updateGitState(): Promise<void>
  getGitHistory(limit?: number): Promise<GitCommit[]>

  // Context optimization
  compressContext(strategy?: ContextCompression['strategy']): Promise<IDEContext>
  filterRelevantContext(threshold?: number): Promise<IDEContext>
  analyzeRelevance(filePaths: string[]): Promise<ContextRelevance[]>

  // Integration support
  syncWithLanguageServer(): Promise<void>
  refreshWorkspaceSettings(): Promise<void>

  // Event system
  onContextChange(callback: (delta: ContextDelta) => void): void
  onFileChange(callback: (change: FileChange) => void): void
  onGitStateChange(callback: (gitState: GitContext) => void): void
}

// Context integration patterns for different editors
export interface IDEIntegration {
  type: 'vscode' | 'cursor' | 'vim' | 'emacs' | 'intellij' | 'generic'
  capabilities: {
    fileWatching: boolean
    cursorTracking: boolean
    selectionTracking: boolean
    languageServer: boolean
    gitIntegration: boolean
    diagnostics: boolean
  }

  // Integration methods
  initialize(): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean

  // Context synchronization
  syncContext(): Promise<IDEContext>
  watchFiles(patterns: string[]): Promise<void>
  unwatchFiles(): Promise<void>

  // Event handlers
  onActiveFileChange(callback: (filePath: string) => void): void
  onCursorMove(callback: (line: number, character: number) => void): void
  onSelectionChange(callback: (selection: IDEContext['selectedText']) => void): void
  onFileCreate(callback: (filePath: string) => void): void
  onFileModify(callback: (filePath: string) => void): void
  onFileDelete(callback: (filePath: string) => void): void
}

// Extended conversation state with context integration
export interface ContextAwareConversationState extends ConversationState {
  context?: IDEContext
  contextHistory: ContextDelta[]
  relevanceAnalysis?: ContextRelevance[]
}

// Enhanced turn context with IDE awareness
export interface ContextAwareTurnContext extends TurnContext {
  ideContext?: IDEContext
  contextCompressionEnabled?: boolean
  relevanceThreshold?: number
}

// Context-aware deep events for streaming
export type ContextEvent =
  | { type: 'context_update'; data: { delta: ContextDelta; context: IDEContext } }
  | { type: 'context_compression'; data: { originalTokens: number; compressedTokens: number; strategy: string } }
  | { type: 'file_change_detected'; data: { change: FileChange; relevance: ContextRelevance } }
  | { type: 'git_state_change'; data: { gitState: GitContext; changedFiles: string[] } }
  | { type: 'active_file_change'; data: { previousFile?: string; newFile: string } }
  | { type: 'cursor_position_change'; data: { line: number; character: number; file: string } }
  | { type: 'context_relevance_analysis'; data: { analysis: ContextRelevance[]; threshold: number } }

// Enhanced DeepEvent with context integration
export type EnhancedDeepEvent = DeepEvent | ContextEvent

// Context-aware engine interface
export interface IContextAwareDeepEngine extends IDeepEngine {
  // Context management
  setContextStore(contextStore: IContextStore): void
  getContextStore(): IContextStore | null
  updateIDEContext(delta: ContextDelta): Promise<void>
  getIDEContext(): Promise<IDEContext | null>

  // Context-aware processing
  processMessageWithContext(
    input: string,
    conversationId?: string,
    contextOptions?: {
      includeContext?: boolean
      compressionStrategy?: ContextCompression['strategy']
      relevanceThreshold?: number
    }
  ): AsyncGenerator<EnhancedDeepEvent>

  // Integration support
  connectIDE(integration: IDEIntegration): Promise<void>
  disconnectIDE(): Promise<void>
  getIDEIntegration(): IDEIntegration | null
}

// ================================
// Sprint 4: Model Intelligence & Routing
// ================================

// Request complexity analysis for intelligent model routing
export interface RequestComplexityAnalysis {
  complexity: 'simple' | 'moderate' | 'complex'
  factors: {
    hasToolCalls: boolean
    requiresReasoning: boolean
    contentLength: number
    previousContext: number // Number of previous messages
    domainSpecific: boolean
    multiStep: boolean
  }
  confidence: number // 0-1 score for complexity assessment
  suggestedModel: string
  reasoning: string
}

// Model routing strategy configuration
export interface ModelRoutingStrategy {
  complexity: 'simple' | 'moderate' | 'complex'
  preferredModel: string
  fallbackModels: string[]
  costThreshold?: number // Maximum cost per token
  latencyThreshold?: number // Maximum response time in ms
  qualityThreshold?: number // Minimum quality score requirement
  conditions?: {
    maxTokens?: number
    requiresReasoning?: boolean
    allowToolCalls?: boolean
    domainRestrictions?: string[]
  }
}

// Performance metrics tracking per model
export interface ModelMetrics {
  modelName: string
  requestCount: number
  successCount: number
  errorCount: number
  totalLatency: number
  averageLatency: number
  totalTokens: {
    input: number
    output: number
    total: number
  }
  totalCost: number
  averageCostPerToken: number
  qualityScores: number[] // User feedback or automated quality assessments
  averageQualityScore: number
  lastUpdated: Date
  weeklyStats?: {
    requests: number
    errors: number
    avgLatency: number
    totalCost: number
  }
  monthlyStats?: {
    requests: number
    errors: number
    avgLatency: number
    totalCost: number
  }
}

// Circuit breaker states for model fallback
export type CircuitBreakerState = 'closed' | 'open' | 'half-open'

// Circuit breaker configuration for model fallbacks
export interface CircuitBreakerConfig {
  failureThreshold: number // Number of failures before opening circuit
  successThreshold: number // Number of successes to close circuit
  timeout: number // Time in ms before trying half-open
  resetTimeout: number // Time in ms before fully resetting
  monitoringWindow: number // Time window for failure counting (ms)
}

// Model fallback system configuration
export interface ModelFallbackConfig {
  enabled: boolean
  circuitBreaker: CircuitBreakerConfig
  retryPolicy: {
    maxRetries: number
    backoffMultiplier: number // Exponential backoff multiplier
    baseDelay: number // Base delay in ms
    maxDelay: number // Maximum delay in ms
    retryableErrors: string[] // Error codes that should trigger retry
  }
  quotaManagement: {
    enabled: boolean
    dailyLimit?: number
    hourlyLimit?: number
    costLimit?: number // Maximum cost per day
    gracefulDegradation: boolean // Switch to cheaper models when near limits
  }
}

// Model availability and health status
export interface ModelAvailability {
  modelName: string
  isAvailable: boolean
  circuitBreakerState: CircuitBreakerState
  lastError?: {
    message: string
    timestamp: Date
    errorCode?: string
  }
  healthScore: number // 0-1 score based on recent performance
  estimatedLatency: number // Expected response time in ms
  quotaStatus: {
    remaining: number
    resetTime?: Date
    nearLimit: boolean
  }
}

// GPT-5 specific optimization parameters
export interface GPT5OptimizationConfig {
  reasoningEffortMapping: {
    simple: 'minimal' | 'low'
    moderate: 'low' | 'medium'
    complex: 'medium' | 'high'
  }
  verbosityMapping: {
    simple: 'low' | 'medium'
    moderate: 'medium'
    complex: 'medium' | 'high'
  }
  automaticOptimization: boolean
  contextAwareParameters: boolean // Adjust parameters based on IDE context
}

// Model intelligence configuration for Sprint 4
export interface ModelIntelligenceConfig {
  enabled: boolean
  routingStrategies: ModelRoutingStrategy[]
  defaultStrategy: string // Name of default routing strategy
  fallbackConfig: ModelFallbackConfig
  gpt5Optimization: GPT5OptimizationConfig
  performanceTracking: {
    enabled: boolean
    metricsRetentionDays: number
    qualityFeedbackEnabled: boolean
    automaticModelSwitching: boolean
  }
  costOptimization: {
    enabled: boolean
    maxDailyCost: number
    preferCheaperModels: boolean
    costThresholdForFallback: number
  }
}

// Model routing events for streaming
export type ModelRoutingEvent =
  | { type: 'model_selection'; data: { selectedModel: string; complexity: RequestComplexityAnalysis; strategy: ModelRoutingStrategy } }
  | { type: 'model_fallback'; data: { fromModel: string; toModel: string; reason: string; circuitBreakerState: CircuitBreakerState } }
  | { type: 'performance_update'; data: { modelName: string; metrics: Partial<ModelMetrics> } }
  | { type: 'circuit_breaker_state_change'; data: { modelName: string; newState: CircuitBreakerState; reason: string } }
  | { type: 'quota_warning'; data: { modelName: string; quotaType: 'daily' | 'hourly' | 'cost'; remaining: number; threshold: number } }
  | { type: 'gpt5_optimization'; data: { originalParams: object; optimizedParams: object; complexity: string } }

// Enhanced DeepEvent with model routing integration
export type ModelIntelligentDeepEvent = DeepEvent | ContextEvent | ModelRoutingEvent

// Model intelligence interface for intelligent model selection
export interface IModelIntelligence {
  // Complexity analysis
  analyzeRequestComplexity(input: string, context?: IDEContext, conversationHistory?: import('./index.js').Item[]): Promise<RequestComplexityAnalysis>

  // Model selection
  selectOptimalModel(complexity: RequestComplexityAnalysis, constraints?: Partial<ModelRoutingStrategy>): Promise<string>

  // Performance tracking
  recordModelMetrics(modelName: string, metrics: Partial<ModelMetrics>): Promise<void>
  getModelMetrics(modelName: string): Promise<ModelMetrics | null>
  getAllModelMetrics(): Promise<ModelMetrics[]>

  // Fallback management
  checkModelAvailability(modelName: string): Promise<ModelAvailability>
  handleModelFailure(modelName: string, error: Error): Promise<string> // Returns fallback model
  resetCircuitBreaker(modelName: string): Promise<void>

  // GPT-5 optimization
  optimizeGPT5Parameters(complexity: RequestComplexityAnalysis, baseParams: object): Promise<object>

  // Cost management
  estimateRequestCost(modelName: string, inputTokens: number, estimatedOutputTokens: number): Promise<number>
  checkDailyCostLimit(): Promise<{ nearLimit: boolean; remaining: number }>

  // Health monitoring
  performHealthCheck(): Promise<{ healthy: boolean; issues: string[] }>
  getSystemStatus(): Promise<{
    modelsAvailable: number
    totalRequests: number
    totalCost: number
    averageLatency: number
  }>
}