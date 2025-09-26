// Main exports for the Deep Agent Core package

// Types - centralized type definitions
export * from './types/index.js'

// Utils - configuration and utilities
export * from './utils/index.js'

// Models - engines and AI model interfaces
export * from './models/index.js'

// Responses - response handling and API types
export * from './responses/index.js'

// Conversations - conversation management
export * from './conversations/index.js'

// Tools - tool system and registry
export * from './tools/index.js'

// Context - IDE context integration (classes only, types are in types module)
export { ContextStore, GitManager, FileWatcher, ContextAnalyzer, ContextCompressor } from './context/index.js'

// Default export for easy usage
export { DeepEngine as default } from './models/deep-engine.js'
