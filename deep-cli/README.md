# Deep Agent - OpenAI Responses API Exclusive

> ⚠️ **Important Note**: This project is built for OpenAI's upcoming Responses API. The current implementation uses placeholder types and interfaces that match the documented API specification. Once the Responses API is officially released in the OpenAI SDK, this codebase will work seamlessly with minimal updates.

A production-ready AI agent built exclusively using OpenAI's new Responses API, designed for multi-turn conversations and agentic workflows.

## Project Status

🚧 **Pre-Release**: This implementation is based on the OpenAI Responses API documentation and is ready for the official API release. The core architecture and interfaces are complete and follow the documented patterns.

### What's Complete:
- ✅ Complete architecture designed around Responses API patterns
- ✅ Multi-turn conversation management with `previous_response_id` support
- ✅ Tool calling pipeline with both built-in and custom tools
- ✅ Configuration management following documented environment conventions
- ✅ CLI interface for interactive sessions
- ✅ Comprehensive test suite structure
- ✅ GPT-5 feature support (verbosity, reasoning effort, CFG, etc.)

### What's Needed:
- 🔄 Official OpenAI SDK with Responses API support
- 🔄 Update import statements once API is released

## Architecture

Deep follows the documented Responses API patterns with a clean separation of concerns:

- **@deep-agent/core**: Core agent engine with Responses API integration
- **@deep-agent/cli**: Command-line interface for interactive sessions  
- **@deep-agent/tests**: Comprehensive test suite with Vitest

## Key Features

### ✅ Responses API First
- Built exclusively on OpenAI's Responses API (not Chat Completions)
- Native support for multi-turn conversations with `previous_response_id`
- Integrated reasoning persistence and tool calling

### ✅ GPT-5 Optimized
- Verbosity control (low/medium/high)
- Reasoning effort settings (minimal/low/medium/high)
- Encrypted reasoning support for ZDR compliance
- Context-free grammar (CFG) support for constrained generation

### ✅ Agentic by Default
- Native tool calling with OpenAI's built-in tools (web search, file search, code interpreter)
- Custom tool support with free-form function calling
- Tool execution pipeline with error handling
- Conversation state management

### ✅ Production Ready
- Comprehensive error handling and logging
- Configuration management via environment variables
- Health checks and API connectivity validation
- Streaming support for real-time interfaces

## Quick Start

### 1. Install Dependencies

```bash
# Install all workspace dependencies
npm install

# Build all packages  
npm run build
```

### 2. Configure Environment

```bash
# Copy example environment file
cp env.example .env

# Edit with your OpenAI API key
# OPENAI_API_KEY=your-key-here
```

### 3. Start Interactive Chat

```bash
# Start interactive session
npx deep chat

# Or ask a single question
npx deep ask "Explain quantum computing"
```

## Configuration

Deep follows the documented environment variable conventions:

### Core Settings
```bash
OPENAI_API_KEY=your-key-here        # Required
OPENAI_MODEL=gpt-5                  # Default model
OPENAI_USE_RESPONSES_DEFAULT=true   # Use Responses API
```

### GPT-5 Steering
```bash  
OPENAI_VERBOSITY=medium             # low|medium|high
OPENAI_REASONING_EFFORT=medium      # minimal|low|medium|high
```

### Advanced Features
```bash
OPENAI_RESP_ENABLE_SUMMARY=false    # Reasoning summaries
OPENAI_RESP_INCLUDE_ENCRYPTED=false # Encrypted reasoning
FIBER_ALLOWED_TOOLS=web_search      # Tool restrictions
```

See `env.example` for complete configuration options.

## CLI Commands

### Interactive Chat
```bash
deep chat                          # Start new conversation
deep chat -c conversation-id       # Resume conversation
deep chat -v high --reasoning low  # Override settings
```

### Single Questions
```bash
deep ask "What is the weather today?"
deep ask "Code a sorting algorithm" --json
```

### Conversation Management
```bash
deep list                          # List conversations
deep clear conversation-id         # Clear specific conversation
deep clear                         # Clear all (with confirmation)
```

### Configuration
```bash
deep config                        # Show current settings
```

## Multi-Turn Conversations

Deep maintains conversation context automatically:

```typescript
import { DeepEngine, loadConfig } from '@deep-agent/core'

const engine = new DeepEngine(loadConfig())

// First turn
for await (const event of engine.processMessage("What is TypeScript?")) {
  console.log(event)
}

// Second turn with context preserved
for await (const event of engine.processMessage("Show me an example", conversationId)) {
  console.log(event) 
}
```

## Tool Integration

### Built-in Tools
Deep supports OpenAI's native tools:
- `web_search`: Real-time web searching
- `file_search`: Document and code search  
- `code_interpreter`: Code execution and analysis

### Custom Tools
Register your own tools:

```typescript
engine.registerTool(
  {
    type: 'function',
    name: 'get_weather',
    description: 'Get current weather for a location',
    parameters: {
      type: 'object',
      properties: {
        location: { type: 'string' }
      }
    }
  },
  async (input: string) => {
    const { location } = JSON.parse(input)
    return `Weather in ${location}: Sunny, 72°F`
  }
)
```

### Free-Form Tools
Use the new `custom` tool type for raw text output:

```typescript
engine.registerTool(
  {
    type: 'custom',
    name: 'sql_query', 
    description: 'Generate SQL queries',
    format: {
      type: 'grammar',
      syntax: 'lark',
      definition: sqlGrammar
    }
  },
  async (rawSql: string) => {
    return executeSQL(rawSql)
  }
)
```

## Development

### Project Structure
```
deep-cli/
├── packages/
│   ├── core/          # Core agent engine
│   ├── cli/           # Command-line interface
│   └── tests/         # Comprehensive test suite
├── docs/              # OpenAI Responses API documentation
└── env.example        # Environment configuration
```

### Testing
```bash
npm test                           # Run all tests
npm run test:coverage             # With coverage
npm run test:ui                   # Interactive UI
```

### Building
```bash
npm run build                     # Build all packages
npm run dev                       # Watch mode
npm run lint                      # Code linting
```

## Responses API Migration

Deep is built from the ground up for the Responses API. Key differences from Chat Completions:

### Items vs Messages
```typescript
// Responses API uses Items (union of many types)
const response = await client.responses.create({
  model: 'gpt-5',
  input: 'Hello!',
  instructions: 'You are a helpful assistant'
})

// vs Chat Completions messages
const completion = await client.chat.completions.create({
  model: 'gpt-5',
  messages: [
    { role: 'system', content: 'You are a helpful assistant' },
    { role: 'user', content: 'Hello!' }
  ]
})
```

### Multi-turn Continuity
```typescript
// Responses API with previous_response_id
const turn2 = await client.responses.create({
  model: 'gpt-5',
  input: 'Continue the conversation',
  previous_response_id: turn1.id
})

// vs Chat Completions manual context management
const turn2 = await client.chat.completions.create({
  model: 'gpt-5', 
  messages: [...previousMessages, newMessage]
})
```

### Function Calling
```typescript
// Responses API (internally-tagged)
{
  type: 'function',
  name: 'get_weather',
  parameters: { ... }
}

// vs Chat Completions (externally-tagged) 
{
  type: 'function',
  function: {
    name: 'get_weather',
    parameters: { ... }
  }
}
```

## Contributing

1. Follow the existing architecture patterns
2. Use Responses API exclusively (no Chat Completions)
3. Add comprehensive tests for new features
4. Update documentation

## License

MIT