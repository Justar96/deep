// Context module exports - Sprint 3: IDE Context Integration
export { ContextStore } from './context-store.js'
export { GitManager } from './git-manager.js'
export { FileWatcher } from './file-watcher.js'
export { ContextAnalyzer } from './context-analyzer.js'
export { ContextCompressor } from './context-compressor.js'

// Re-export context-related types for convenience
export type {
  IContextStore,
  IDEContext,
  ContextDelta,
  FileChange,
  GitContext,
  GitCommit,
  WorkspaceSettings,
  ContextRelevance,
  ContextCompression,
  LanguageServerInfo,
  Diagnostic,
  Symbol,
  IDEIntegration,
  ContextAwareConversationState,
  ContextAwareTurnContext,
  ContextEvent,
  EnhancedDeepEvent,
  IContextAwareDeepEngine
} from '../types.js'