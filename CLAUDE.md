# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Architecture

This is a **Deep AI agent** monorepo built around the OpenAI Responses API for multi-turn agentic conversations. The project follows enterprise-grade patterns with comprehensive IDE context integration and sophisticated tool management.

### ✅ **PRODUCTION STATUS: SPRINT 4 COMPLETE + MODEL INTELLIGENCE SYSTEM**

The Deep agent has completed **Sprint 4: Model Intelligence & Routing** with sophisticated model selection, optimization, and fallback capabilities. The project now features intelligent model routing based on request complexity, GPT-5 parameter optimization, circuit breaker patterns, and comprehensive performance metrics tracking.

**Current Status:**
- ✅ **Architecture Standardization**: Clean flat monorepo structure following best practices
- ✅ **Sprint 1**: Advanced Conversation Management with intelligent compression and memory optimization
- ✅ **Sprint 2**: Enhanced Tool System with confirmation workflows, risk assessment, and audit trails
- ✅ **Sprint 3**: IDE Context Integration with intelligent workspace awareness and context management
- ✅ **Sprint 4**: Model Intelligence & Routing with dynamic model selection and optimization
- ✅ **Comprehensive Test Suite**: 383+ tests total with model intelligence coverage
- ✅ **Enterprise Security**: Tool confirmation system with risk-based approval workflows
- ✅ **Production Safety**: Emergency stops, impact analysis, and comprehensive audit logging
- ✅ **Cross-Platform**: Windows/Unix compatibility with standardized build scripts
- ✅ **IDE Integration**: Real-time context awareness with VSCode, Cursor, and LSP support
- ✅ **Model Intelligence**: Adaptive model routing, fallback systems, and performance optimization

### Core Architecture

- **Standardized Monorepo**: Clean flat structure with packages in `packages/*`
- **Core Engine**: `@deep-agent/core` - Main agent engine using OpenAI Responses API exclusively
- **CLI Package**: `@deep-agent/cli` - Command-line interface with co-located tests
- **Test Strategy**: Co-located testing with shared test utilities
- **Shared Configurations**: Base TypeScript and Vitest configs for consistency across packages
- **Cross-Platform Build**: Windows/Unix compatible scripts with proper dependency management

### Key Components

- **DeepEngine** (`packages/core/src/models/deep-engine.ts`) - Main orchestrator with enhanced tool management
- **ContextAwareDeepEngine** (`packages/core/src/models/context-aware-engine.ts`) - IDE-aware engine with context integration
- **ResponseClient** (`packages/core/src/responses/response-client.ts`) - Normalized OpenAI Responses API client
- **ConversationManager** (`packages/core/src/conversations/conversation-manager.ts`) - Advanced conversation state with compression and memory management
- **ContextStore** (`packages/core/src/context/context-store.ts`) - IDE context management and tracking
- **GitManager** (`packages/core/src/context/git-manager.ts`) - Real-time Git state monitoring and change detection
- **FileWatcher** (`packages/core/src/context/file-watcher.ts`) - File system change tracking with debouncing
- **ContextAnalyzer** (`packages/core/src/context/context-analyzer.ts`) - Intelligent context relevance analysis
- **ContextCompressor** (`packages/core/src/context/context-compressor.ts`) - Smart context compression for large codebases
- **ToolRegistry** (`packages/core/src/tools/tool-registry.ts`) - Enterprise tool system with confirmations and audit trails
- **ToolConfirmationBus** (`packages/core/src/tools/tool-confirmation-bus.ts`) - Message bus for async user approvals
- **ToolImpactAnalyzer** (`packages/core/src/tools/tool-impact-analyzer.ts`) - Risk assessment and impact analysis
- **ToolAuditTrail** (`packages/core/src/tools/tool-audit-trail.ts`) - Comprehensive audit logging system
- **Configuration** (`packages/core/src/utils/config.ts`) - Enhanced with Sprint 4 model intelligence settings
- **ModelIntelligence** (`packages/core/src/models/model-intelligence.ts`) - Intelligent model selection and routing system
- **ComplexityAnalyzer** (`packages/core/src/models/complexity-analyzer.ts`) - Request complexity analysis for optimal model selection
- **IntelligentResponseClient** (`packages/core/src/models/intelligent-response-client.ts`) - Model-aware response client with fallback and optimization
- **IntelligentDeepEngine** (`packages/core/src/models/intelligent-deep-engine.ts`) - Enhanced engine with model intelligence integration

### API Strategy: Responses API First

This project uses **OpenAI Responses API over Chat Completions** for GPT-5, following patterns documented in `docs/openai/migrate-to-responses-api.md`. The Responses API provides better reasoning persistence, improved tool calling, and cleaner semantics for agentic workflows.

## Usage Commands (Primary Interface)

### CLI Operations
- `npm run dev:cli` - Start CLI in development mode
- `npm run build` - Build all packages
- `npm run test` - Run comprehensive test suite across all packages
- `npm run lint` - ESLint across all packages
- `npm run typecheck` - TypeScript type checking

### CLI Commands (after build)
```bash
# Interactive conversation mode
npx deep chat

# Single-shot queries
npx deep ask "question" --json

# Conversation management
npx deep list
npx deep clear [id]
npx deep config
```

### Advanced Usage Examples
```bash
# Interactive chat with GPT-5 features
npx deep chat --model gpt-5 --verbosity high --reasoning medium

# Complex agentic request with function calling
npx deep ask "What time is it? Then create a Python fibonacci function."

# JSON output for programmatic use
npx deep ask "Generate a REST API schema" --json
```

## Development Commands

### Build Commands
- `npm run build` - Build all packages
- `npm run clean` - Clean all build artifacts and node_modules
- `npm run dev` - Development mode (watch) for all packages
- `npm run dev:core` - Core package development mode
- `npm run dev:cli` - CLI package development mode

### Testing Commands
- `npm run test` - Run tests across all packages (373 tests total)
- `npm run test:cli` - CLI tests only (54 tests, 100% pass rate)
- `npm run test:core` - Core tests only (320 tests, 319/320 passing)
- `npm run test:coverage` - Run tests with coverage reports
- `npm run test:watch` - Run tests in watch mode for development

### Linting & Formatting
- `npm run lint` - ESLint across all packages
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run typecheck` - TypeScript type checking
- `npm run format` - Prettier formatting
- `npm run format:check` - Check Prettier formatting

### Release Management
- `npm run changeset` - Create changeset for versioning
- `npm run version` - Bump versions using changesets
- `npm run release` - Build and publish packages

## Environment Configuration

Based on `docs/openai/env-vars.md` and `.github/copilot-instructions.md`:

### Required
- `OPENAI_API_KEY` - OpenAI API key

### Model Configuration
- `OPENAI_MODEL` / `OPENAI_DEFAULT_MODEL` - Model selection (default: gpt-5)
- `OPENAI_BASE_URL` - Custom API base URL (optional)

### Responses API Settings
- `OPENAI_USE_RESPONSES_DEFAULT=true` - Enable Responses API mode (default: true)
- `OPENAI_STREAM=true` - Enable streaming (default: true)
- `OPENAI_RESP_STORE=true` - Store conversations (default: true)

### GPT-5 Steering Parameters
- `OPENAI_VERBOSITY` - Text verbosity (low|medium|high, default: medium)
- `OPENAI_REASONING_EFFORT` - Reasoning effort (minimal|low|medium|high, default: medium)

### Advanced Features
- `OPENAI_RESP_ENABLE_SUMMARY=false` - Auto-generate reasoning summaries
- `OPENAI_RESP_INCLUDE_ENCRYPTED=false` - Include encrypted reasoning steps
- `FIBER_ALLOWED_TOOLS` - Comma-separated list of allowed tools
- `OPENAI_LOG_PATHS=false` - Debug path logging

### Conversation Management (Sprint 1)
- `DEEP_COMPRESSION_ENABLED=true` - Enable intelligent conversation compression
- `DEEP_COMPRESSION_THRESHOLD=0.7` - Token threshold for compression trigger (0.1-1.0)
- `DEEP_COMPRESSION_STRATEGY=summarize` - Compression strategy (summarize|selective|truncate)
- `DEEP_COMPRESSION_PRESERVE_CONTEXT=true` - Preserve function call chains during compression
- `DEEP_COMPRESSION_MAX_RATIO=0.3` - Maximum compression ratio (0.1-0.8)
- `DEEP_MAX_TOKENS=8000` - Maximum tokens before compression triggers
- `DEEP_CURATION_ENABLED=true` - Enable automatic message curation
- `DEEP_HEALTH_CHECK_INTERVAL=30` - Minutes between conversation health checks

### Enhanced Tool System (Sprint 2)
- `DEEP_TOOL_CONFIRMATION_ENABLED=true` - Enable tool confirmation workflows
- `DEEP_TOOL_CONFIRMATION_TIMEOUT_MS=30000` - Confirmation timeout in milliseconds
- `DEEP_TOOL_AUTO_APPROVAL_LOW_RISK=true` - Auto-approve low-risk operations
- `DEEP_TOOL_AUDIT_TRAIL_ENABLED=true` - Enable comprehensive audit logging
- `DEEP_TOOL_SANDBOXING_ENABLED=false` - Enable tool execution sandboxing
- `DEEP_TOOL_EMERGENCY_STOP_ENABLED=true` - Enable emergency stop capability
- `DEEP_TOOL_MAX_CONCURRENT_EXECUTIONS=5` - Maximum concurrent tool executions
- `DEEP_TOOL_EXECUTION_TIMEOUT_MS=60000` - Individual tool execution timeout

### IDE Context Integration (Sprint 3)
- `DEEP_CONTEXT_ENABLED=true` - Enable IDE context integration and awareness
- `DEEP_CONTEXT_UPDATE_STRATEGY=smart` - Context update strategy (delta|full|smart)
- `DEEP_CONTEXT_COMPRESSION_ENABLED=true` - Enable intelligent context compression
- `DEEP_CONTEXT_COMPRESSION_THRESHOLD=4000` - Token threshold for context compression
- `DEEP_CONTEXT_MAX_SIZE=8000` - Maximum context size in tokens
- `DEEP_CONTEXT_REFRESH_INTERVAL_MS=30000` - Auto-refresh interval for project state
- `DEEP_CONTEXT_TRACK_FILE_CHANGES=true` - Enable file system change tracking
- `DEEP_CONTEXT_TRACK_CURSOR_POSITION=true` - Enable cursor position tracking
- `DEEP_CONTEXT_TRACK_GIT_STATE=true` - Enable Git state monitoring
- `DEEP_CONTEXT_RELEVANCE_THRESHOLD=0.5` - Relevance filtering threshold (0.0-1.0)

### Model Intelligence & Routing (Sprint 4)
- `DEEP_MODEL_INTELLIGENCE_ENABLED=true` - Enable intelligent model selection and routing
- `DEEP_MODEL_SIMPLE_PREFERRED=gpt-5-mini` - Preferred model for simple requests
- `DEEP_MODEL_SIMPLE_FALLBACKS=gpt-5-nano,gpt-4o` - Fallback models for simple complexity
- `DEEP_MODEL_MODERATE_PREFERRED=gpt-5` - Preferred model for moderate requests
- `DEEP_MODEL_MODERATE_FALLBACKS=gpt-5-mini,gpt-4o` - Fallback models for moderate complexity
- `DEEP_MODEL_COMPLEX_PREFERRED=gpt-5` - Preferred model for complex requests
- `DEEP_MODEL_COMPLEX_FALLBACKS=gpt-4o` - Fallback models for complex complexity
- `DEEP_MODEL_DEFAULT_STRATEGY=moderate` - Default routing strategy to use
- `DEEP_MODEL_FALLBACK_ENABLED=true` - Enable model fallback system
- `DEEP_MODEL_CIRCUIT_BREAKER_FAILURE_THRESHOLD=5` - Failures before opening circuit breaker
- `DEEP_MODEL_CIRCUIT_BREAKER_SUCCESS_THRESHOLD=3` - Successes needed to close circuit
- `DEEP_MODEL_CIRCUIT_BREAKER_TIMEOUT=60000` - Circuit breaker timeout in milliseconds
- `DEEP_MODEL_CIRCUIT_BREAKER_RESET_TIMEOUT=300000` - Circuit breaker reset timeout
- `DEEP_MODEL_CIRCUIT_BREAKER_MONITORING_WINDOW=600000` - Monitoring window for failures
- `DEEP_MODEL_RETRY_MAX_RETRIES=3` - Maximum retry attempts
- `DEEP_MODEL_RETRY_BACKOFF_MULTIPLIER=2.0` - Exponential backoff multiplier
- `DEEP_MODEL_RETRY_BASE_DELAY=1000` - Base delay for retries in milliseconds
- `DEEP_MODEL_RETRY_MAX_DELAY=30000` - Maximum retry delay
- `DEEP_MODEL_RETRY_ERRORS=rate_limit_exceeded,server_error,timeout` - Retryable error types
- `DEEP_MODEL_QUOTA_ENABLED=true` - Enable quota management
- `DEEP_MODEL_QUOTA_DAILY_LIMIT=1000` - Daily request limit (optional)
- `DEEP_MODEL_QUOTA_HOURLY_LIMIT=100` - Hourly request limit (optional)
- `DEEP_MODEL_QUOTA_COST_LIMIT=50.0` - Daily cost limit in dollars (optional)
- `DEEP_MODEL_QUOTA_GRACEFUL_DEGRADATION=true` - Enable graceful degradation near limits
- `DEEP_MODEL_GPT5_REASONING_SIMPLE=minimal` - GPT-5 reasoning effort for simple requests
- `DEEP_MODEL_GPT5_REASONING_MODERATE=low` - GPT-5 reasoning effort for moderate requests
- `DEEP_MODEL_GPT5_REASONING_COMPLEX=medium` - GPT-5 reasoning effort for complex requests
- `DEEP_MODEL_GPT5_VERBOSITY_SIMPLE=low` - GPT-5 verbosity for simple requests
- `DEEP_MODEL_GPT5_VERBOSITY_COMPLEX=medium` - GPT-5 verbosity for complex requests
- `DEEP_MODEL_GPT5_AUTO_OPTIMIZATION=true` - Enable automatic GPT-5 parameter optimization
- `DEEP_MODEL_GPT5_CONTEXT_AWARE_PARAMS=true` - Adjust parameters based on IDE context
- `DEEP_MODEL_PERFORMANCE_TRACKING_ENABLED=true` - Enable performance metrics tracking
- `DEEP_MODEL_METRICS_RETENTION_DAYS=30` - Days to retain performance metrics
- `DEEP_MODEL_QUALITY_FEEDBACK_ENABLED=false` - Enable quality feedback collection
- `DEEP_MODEL_AUTO_SWITCHING_ENABLED=true` - Enable automatic model switching
- `DEEP_MODEL_COST_OPTIMIZATION_ENABLED=true` - Enable cost optimization features
- `DEEP_MODEL_MAX_DAILY_COST=100.0` - Maximum daily cost in dollars
- `DEEP_MODEL_PREFER_CHEAPER_MODELS=false` - Prefer cheaper models when possible
- `DEEP_MODEL_COST_THRESHOLD_FALLBACK=0.1` - Cost threshold for fallback to cheaper models

## Key Technologies

- **TypeScript** - Strict typing throughout
- **Vitest** - Testing framework
- **Zod** - Runtime schema validation
- **OpenAI SDK v5** - Latest SDK for Responses API support
- **EventEmitter3** - Event-driven architecture for streaming
- **UUID** - Conversation and response ID generation
- **Tiktoken** - Precise token counting for compression accuracy
- **Ajv** - JSON schema validation for tool parameters

## Documentation Structure

The `docs/openai/` directory contains comprehensive GPT-5 integration documentation:
- Migration guides for Responses API
- Prompt optimization methodologies
- Environment configuration references
- Performance evaluation patterns
- Frontend integration recommendations (Next.js + Tailwind)

## Implementation Status & Capabilities

### ✅ **Completed Features**
- **Multi-turn Conversations**: Full context preservation with `previous_response_id` chaining
- **Function Calling**: Working tool execution with proper OpenAI Responses API integration
- **Streaming Responses**: Real-time text generation with progressive UI updates
- **GPT-5 Integration**: Reasoning effort control, verbosity settings, model-specific optimizations
- **Error Handling**: Comprehensive error recovery and logging throughout the pipeline
- **Configuration Management**: Environment-based settings with Zod validation
- **Advanced Conversation Management (Sprint 1)**: Intelligent compression, memory optimization, concurrency safety
- **Enhanced Tool System (Sprint 2)**: Tool confirmation workflows, risk assessment, audit trails, emergency stops
- **IDE Context Integration (Sprint 3)**: Real-time workspace awareness, intelligent context compression, Git state tracking
- **Model Intelligence & Routing (Sprint 4)**: Dynamic model selection, circuit breaker fallbacks, GPT-5 optimization, performance metrics
- **Comprehensive Test Suite**: 383+ tests with comprehensive model intelligence coverage ensuring production reliability

### 🚀 **Advanced Agentic Features**
- **Reasoning Persistence**: Chain-of-thought continuity across conversation turns
- **Enhanced Tool Registry**: Enterprise-grade tool system with confirmations and risk assessment
- **Event-Driven Architecture**: Streaming events for real-time UI integration with comprehensive event types
- **Context Management**: Intelligent conversation state with memory persistence
- **Model Detection**: Automatic feature enablement based on model capabilities
- **Intelligent Compression**: OpenAI-powered conversation summarization with function call preservation
- **Memory Management**: Proactive cleanup with batch processing and periodic health checks
- **Concurrency Safety**: Race-condition protection with conversation-level locking
- **Token Accuracy**: Tiktoken-based precise token counting for optimal compression triggers
- **Tool Confirmation System**: Message bus architecture for async user approvals
- **Risk Assessment**: Automated analysis of tool operations and impact
- **Audit Trail System**: Comprehensive logging with security reporting
- **Emergency Stop**: System-wide tool execution halt capability
- **IDE Context Awareness**: Real-time tracking of active files, cursor position, and selected text
- **Git State Integration**: Live monitoring of repository changes, branches, and commit history
- **File System Monitoring**: Debounced file change detection with relevance scoring
- **Context Compression**: Smart compression strategies for large codebases with relevance filtering
- **Delta-Based Updates**: Efficient context updates minimizing token usage
- **Multi-IDE Support**: VSCode, Cursor, and Language Server Protocol integration patterns
- **Intelligent Model Routing**: Dynamic model selection based on request complexity analysis
- **Circuit Breaker Patterns**: Automatic fallback to alternative models on failures with exponential backoff
- **GPT-5 Parameter Optimization**: Automatic reasoning effort and verbosity adjustment based on complexity
- **Performance Metrics Tracking**: Real-time monitoring of model latency, cost, success rates, and health scores
- **Cost Optimization**: Smart model selection to minimize costs while maintaining quality
- **Quota Management**: Daily/hourly limits with graceful degradation and circuit breaker protection
- **Request Complexity Analysis**: Multi-dimensional analysis considering tools, reasoning, content length, and domain specificity

## Development Notes

### 🚨 **Testing and Quality Assurance**

**Current Test Status:**
- **Total Tests**: 383+ across all packages
- **CLI Package**: 54/54 tests passing (100%)
- **Core Package**: 329/330 tests passing (99.7%) including model intelligence suite
- **Model Intelligence**: 40+ comprehensive tests covering complexity analysis, routing, fallbacks, and optimization
- **Known Issue**: 1 failing test in IDE event handling (character vs column property naming)

**Testing Workflow:**
1. Run `npm run test` to execute full test suite
2. Use `npm run test:watch` for development
3. Check `npm run test:coverage` for coverage reports
4. Address failing tests before considering features complete

### Core Patterns
- Always use the Responses API pattern shown in the core types
- Follow the established event streaming architecture in `DeepEvent` types
- Configuration changes should update both `config.ts` and the Zod schema
- New tools must be registered through the `ToolRegistry` with proper risk assessment
- Conversation persistence follows the enhanced `ConversationState` interface with metrics and health tracking
- Use conversation-level locking for concurrent access to prevent race conditions
- Implement proper resource cleanup for tiktoken encoders and conversation locks
- Follow batch processing patterns for memory-intensive operations
- Tool operations require risk assessment and appropriate confirmation workflows
- All tool executions must be logged through the audit trail system
- Emergency stop capability must be respected by all tool implementations
- Model selection should consider request complexity and cost optimization (Sprint 4)
- Use intelligent response clients for automatic model routing and fallback handling
- GPT-5 parameters should be optimized automatically based on complexity analysis
- Circuit breaker patterns must be respected for model availability and health

### Function Calling Implementation
- Use `item.arguments` (not `item.input`) for OpenAI Responses API function calls
- Tool results use `function_call_output` type with proper `call_id` matching
- Avoid duplicate function call IDs by not adding `response.output` twice in follow-up requests

### Streaming Architecture
- `processResponse` method must be async generator to properly yield events
- Use `yield*` for delegating to nested generators
- Core event types: `turn_start`, `response_start`, `content_delta`, `tool_call`, `tool_result`, `turn_complete`
- Tool Events: `tool_confirmation_request`, `tool_approved`, `tool_denied`, `tool_impact_analysis`, `tool_execution_start`, `tool_audit_log`, `emergency_stop`
- Model Events: `model_selection`, `model_fallback`, `performance_update`, `circuit_breaker_state_change`, `quota_warning`, `gpt5_optimization`

### Model Compatibility & Intelligence
- GPT-5 steering parameters (`reasoning.effort`, `text.verbosity`) only for `gpt-5*` models
- Fall back gracefully for older models that don't support advanced features
- Test with `gpt-5-mini` for reliable Responses API compatibility
- Model routing considers complexity: simple→gpt-5-mini, moderate→gpt-5, complex→gpt-5
- Circuit breakers prevent cascading failures across model endpoints
- Automatic parameter optimization based on request complexity analysis
- Cost-aware fallback to cheaper models when approaching quota limits

## Troubleshooting

### Common Issues
1. **Empty responses**: Check `content.type === 'output_text'` extraction logic
2. **Function call failures**: Verify `item.arguments` vs `item.input` usage
3. **Duplicate call_id errors**: Don't include `response.output` in follow-up requests
4. **Model parameter errors**: Only send GPT-5 parameters to supported models
5. **Memory issues**: Check conversation cleanup settings and batch size configuration
6. **Token counting errors**: Verify tiktoken encoder initialization for the target model
7. **Compression failures**: Check OpenAI API connectivity and fallback to truncation strategy
8. **Race conditions**: Ensure conversation locking is enabled in production environment
9. **Tool confirmation timeouts**: Check `DEEP_TOOL_CONFIRMATION_TIMEOUT_MS` setting
10. **Tool execution failures**: Review audit trail and check emergency stop status
11. **Permission errors**: Verify tool risk assessment and approval workflows
12. **IDE context errors**: Verify property naming consistency (character vs column)
13. **Model selection failures**: Check `DEEP_MODEL_INTELLIGENCE_ENABLED` and routing configuration
14. **Circuit breaker issues**: Review failure thresholds and reset circuit breakers manually if needed
15. **GPT-5 parameter errors**: Ensure optimization is enabled and parameters are valid for the model
16. **Performance metrics errors**: Check metrics retention settings and storage connectivity
17. **Cost limit exceeded**: Review daily/hourly limits and enable graceful degradation
18. **Model fallback loops**: Verify fallback model availability and circuit breaker states

### Debug Commands
```bash
# Enable detailed logging
OPENAI_LOG_PATHS=true npm run dev:cli

# Test specific model
npx deep ask "test" --model gpt-5-mini

# Check configuration
npx deep config

# Run specific test suite
npm run test:core
npm run test:cli

# Test model intelligence features
npm run test -- --testNamePattern="Model Intelligence"

# Check model metrics and system status
npx deep status --models

# Reset circuit breakers
npx deep models reset-circuit-breaker --model gpt-5

# Check cost tracking
npx deep models cost-status
```

## Known Issues

### Current Test Failures
1. **IDE Event Handling Test**: Property naming mismatch between `character` and `column` in position objects
   - Location: `packages/core/src/__tests__/context-aware-engine.test.ts:262`
   - Impact: Minor - affects IDE integration test validation only
   - Fix: Standardize position property naming across IDE interfaces

## Next Steps

### Immediate Priorities
1. **Fix IDE Test Failure**: Resolve character/column property naming inconsistency
2. **Complete Test Suite**: Achieve 100% test pass rate
3. **Performance Optimization**: Profile and optimize conversation compression algorithms
4. **Documentation**: Update API documentation to reflect current implementation

### Future Enhancements
- **Advanced Context Features**: Enhanced relevance scoring and context prioritization
- **Extended IDE Support**: Additional IDE integrations beyond VSCode/Cursor
- **Performance Monitoring**: Real-time performance metrics and alerting
- **Security Hardening**: Enhanced sandboxing and permission management