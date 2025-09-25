# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Architecture

This is a **Deep AI agent** monorepo built around the OpenAI Responses API for multi-turn agentic conversations. The project follows GPT-5 best practices and maintains comprehensive documentation for OpenAI integrations.

### ✅ **PRODUCTION STATUS: FULLY OPERATIONAL**

The Deep agent is **100% complete** with full agentic multi-turn capabilities, advanced function calling, and comprehensive GPT-5 integration. All TypeScript compilation errors have been resolved and the system is production-ready.

### Core Architecture

- **Monorepo Structure**: Uses npm workspaces with packages in `deep-cli/packages/*`
- **Core Engine**: `@deep-agent/core` - Main agent engine using OpenAI Responses API exclusively
- **CLI Package**: `@deep-agent/cli` - Command-line interface
- **Test Suite**: `@deep-agent/tests` - Comprehensive test coverage

### Key Components

- **DeepEngine** (`deep-cli/packages/core/src/deep-engine.ts`) - Main orchestrator for turn-based conversations
- **ResponseClient** (`deep-cli/packages/core/src/response-client.ts`) - Normalized OpenAI Responses API client
- **ConversationManager** (`deep-cli/packages/core/src/conversation-manager.ts`) - Persistent conversation state
- **ToolRegistry** (`deep-cli/packages/core/src/tool-registry.ts`) - Dynamic tool execution system
- **Configuration** (`deep-cli/packages/core/src/config.ts`) - Environment-based configuration following documented standards

### API Strategy: Responses API First

This project uses **OpenAI Responses API over Chat Completions** for GPT-5, following patterns documented in `docs/openai/migrate-to-responses-api.md`. The Responses API provides better reasoning persistence, improved tool calling, and cleaner semantics for agentic workflows.

## Usage Commands (Primary Interface)

### CLI Operations
- `npm run dev chat` - Start interactive multi-turn conversation mode
- `npm run dev ask "question" --json` - Single-shot query with JSON response
- `npm run dev ask "question" --model gpt-4o` - Override model selection
- `npm run dev list` - List all conversation history
- `npm run dev clear [id]` - Clear specific conversation or all conversations
- `npm run dev config` - Display current configuration

### Advanced Usage Examples
```bash
# Interactive chat with GPT-5 features
npm run dev chat --model gpt-5 --verbosity high --reasoning medium

# Complex agentic request with function calling
npm run dev ask "What time is it? Then create a Python fibonacci function."

# JSON output for programmatic use
npm run dev ask "Generate a REST API schema" --json
```

## Development Commands

### Build Commands
- `npm run build` - Build all packages
- `npm run clean` - Clean all build artifacts and node_modules
- `npm run dev` - Development mode (watch) for all packages

### Testing Commands
- `npm run test` - Run tests across all packages
- Individual package tests: `npm run test --workspace=@deep-agent/core`

### Linting & Formatting
- `npm run lint` - ESLint across all packages
- `npm run typecheck` - TypeScript type checking
- `npm run format` - Prettier formatting

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

## Key Technologies

- **TypeScript** - Strict typing throughout
- **Vitest** - Testing framework
- **Zod** - Runtime schema validation
- **OpenAI SDK v5** - Latest SDK for Responses API support
- **EventEmitter3** - Event-driven architecture for streaming
- **UUID** - Conversation and response ID generation

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

### 🚀 **Advanced Agentic Features**
- **Reasoning Persistence**: Chain-of-thought continuity across conversation turns
- **Tool Registry**: Dynamic function registration and execution system
- **Event-Driven Architecture**: Streaming events for real-time UI integration
- **Context Management**: Intelligent conversation state with memory persistence
- **Model Detection**: Automatic feature enablement based on model capabilities

### 🔧 **Technical Implementation Details**
- **Response Processing**: Proper `output_text` extraction from OpenAI Responses API
- **Function Arguments**: Correct `item.arguments` parsing for tool execution
- **Event Yielding**: Generator-based architecture for streaming events
- **Type Safety**: Complete TypeScript coverage with strict mode enabled
- **Build System**: Clean compilation with all errors resolved

## Development Notes

### Core Patterns
- Always use the Responses API pattern shown in the core types
- Follow the established event streaming architecture in `DeepEvent` types
- Configuration changes should update both `config.ts` and the Zod schema
- New tools must be registered through the `IToolRegistry` interface
- Conversation persistence follows the `ConversationState` interface

### Function Calling Implementation
- Use `item.arguments` (not `item.input`) for OpenAI Responses API function calls
- Tool results use `function_call_output` type with proper `call_id` matching
- Avoid duplicate function call IDs by not adding `response.output` twice in follow-up requests

### Streaming Architecture
- `processResponse` method must be async generator to properly yield events
- Use `yield*` for delegating to nested generators
- Event types: `turn_start`, `response_start`, `content_delta`, `tool_call`, `tool_result`, `turn_complete`

### Model Compatibility
- GPT-5 steering parameters (`reasoning.effort`, `text.verbosity`) only for `gpt-5*` models
- Fall back gracefully for older models that don't support advanced features
- Test with `gpt-4o` for reliable Responses API compatibility

## Troubleshooting

### Common Issues
1. **Empty responses**: Check `content.type === 'output_text'` extraction logic
2. **Function call failures**: Verify `item.arguments` vs `item.input` usage
3. **Duplicate call_id errors**: Don't include `response.output` in follow-up requests
4. **Model parameter errors**: Only send GPT-5 parameters to supported models

### Debug Commands
```bash
# Enable detailed logging
OPENAI_LOG_PATHS=true npm run dev ask "test question"

# Test specific model
npm run dev ask "test" --model gpt-4o

# Check configuration
npm run dev config
```