// Test configuration helper to ensure consistent DeepConfig across all tests
import type { DeepConfig } from '@deep-agent/core'

/**
 * Creates a standardized test configuration with all required properties
 * including the Sprint 2 tools configuration that was missing from tests
 */
export function createTestConfig(overrides: Partial<DeepConfig> = {}): DeepConfig {
  const baseConfig: DeepConfig = {
    // Core API settings
    apiKey: 'test-api-key',
    baseUrl: null,
    model: 'gpt-4o-mini',

    // Responses API behavior
    useResponsesDefault: true,
    stream: true,
    store: true,

    // GPT-5 steering parameters
    verbosity: 'medium',
    reasoningEffort: 'medium',

    // Advanced features
    enableSummary: false,
    includeEncrypted: false,

    // Tool access control
    allowedTools: [],

    // Debugging
    logPaths: false,

    // Conversation management settings (Sprint 1)
    conversation: {
      compression: {
        enabled: true,
        threshold: 0.7,
        strategy: 'summarize',
        preserveContext: true,
        maxCompressionRatio: 0.3,
      },
      maxTokens: 8000,
      curationEnabled: true,
      healthCheckInterval: 30,
    },

    // Enhanced tool system configuration (Sprint 2) - THIS WAS MISSING
    tools: {
      confirmationEnabled: true,
      confirmationTimeoutMs: 30000,
      autoApprovalForLowRisk: true,
      auditTrailEnabled: true,
      sandboxingEnabled: false,
      emergencyStopEnabled: true,
      maxConcurrentExecutions: 5,
      executionTimeoutMs: 60000,
    },

    // IDE Context Integration configuration (Sprint 3)
    context: {
      enabled: true,
      updateStrategy: 'smart',
      compressionEnabled: true,
      compressionThreshold: 4000,
      maxContextSize: 8000,
      refreshIntervalMs: 30000,
      trackFileChanges: true,
      trackCursorPosition: true,
      trackGitState: true,
      relevanceThreshold: 0.5,
    },
  }

  return { ...baseConfig, ...overrides }
}

/**
 * Creates a minimal test configuration for tests that don't need full features
 */
export function createMinimalTestConfig(overrides: Partial<DeepConfig> = {}): DeepConfig {
  return createTestConfig({
    // Disable features for simpler testing
    conversation: {
      compression: {
        enabled: false,
        threshold: 0.7,
        strategy: 'truncate',
        preserveContext: false,
        maxCompressionRatio: 0.3,
      },
      maxTokens: 8000,
      curationEnabled: false,
      healthCheckInterval: 30,
    },
    tools: {
      confirmationEnabled: false,
      confirmationTimeoutMs: 30000,
      autoApprovalForLowRisk: true,
      auditTrailEnabled: false,
      sandboxingEnabled: false,
      emergencyStopEnabled: false,
      maxConcurrentExecutions: 1,
      executionTimeoutMs: 30000,
    },
    context: {
      enabled: false,
      updateStrategy: 'smart',
      compressionEnabled: false,
      compressionThreshold: 4000,
      maxContextSize: 8000,
      refreshIntervalMs: 30000,
      trackFileChanges: false,
      trackCursorPosition: false,
      trackGitState: false,
      relevanceThreshold: 0.5,
    },
    ...overrides,
  })
}

/**
 * Creates test events with proper DeepEvent type structure
 */
export function createTestEvent(type: string, data: any) {
  return { type, data }
}

/**
 * Creates a test conversation state with all required properties
 */
export function createTestConversationState(overrides: any = {}) {
  return {
    id: 'test-conversation-id',
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    lastResponseId: 'test-response-id',
    metadata: {},
    metrics: {
      tokenUsage: { input: 0, output: 0, total: 0 },
      turnCount: 0,
      toolCallCount: 0,
      compressionEvents: 0,
    },
    compressionSummary: null,
    health: {
      isValid: true,
      hasInvalidResponses: false,
      continuityScore: 1.0,
      issues: [],
    },
    ...overrides,
  }
}