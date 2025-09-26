// Main exports for the Deep Agent Core package
export * from './types.js'
export * from './types/index.js'
export * from './config.js'
export * from './deep-engine.js'
export * from './response-client.js'
export * from './conversation-manager.js'
export * from './conversation-compression.js'
export * from './base-tool-registry.js'
export * from './tool-registry.js'
export * from './turn.js'

// Sprint 2: Enhanced Tool System exports
export * from './tool-confirmation-bus.js'
export * from './tool-impact-analyzer.js'
export * from './tool-audit-trail.js'

// Sprint 3: IDE Context Integration exports
export * from './context/index.js'
export * from './context-aware-engine.js'

// Default export for easy usage
export { DeepEngine as default } from './deep-engine.js'