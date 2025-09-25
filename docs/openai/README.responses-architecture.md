# Responses-only architecture (Fiber)

Fiber now uses OpenAI's Responses API for all agentic LLM calls. This page summarizes how the current pipeline is composed and how to integrate new behavior safely.

## Key pieces

- `OpenAIAgentEngine`: orchestrates conversation state, compression, and turn execution.
- `Turn`: drives the agentic loop per user message, handling streaming events, tool execution, and follow-ups.
- `OpenAIResponseClient`: wraps `client.responses.create`/`stream`, normalizes usage, and centralizes error handling.
- Tool registry: exposes Response API-compatible tool definitions and filters them based on workspace trust.

## What the loop does

- `OpenAIAgentEngine.processMessage(Stream)` creates a `Turn`, seeds conversation history, and forwards workspace context.
- `Turn.run` calls `OpenAIResponseClient.createResponseStream({ model, input, tools, tool_choice, reasoning, text, previousResponseId })` and emits streaming UI events.
- When function calls are returned, `Turn` executes tools via the registry, then calls `client.followupResponse` with `function_call_output` payloads and the prior `response_id`.
- Iteration continues until no further tool calls remain, after which a `finished` event carries the final usage and reasoning items back to the engine.

## Parameters of interest

- `max_output_tokens`: supplied from config or request overrides.
- `tool_choice`: always in `allowed_tools` mode; the tool list comes from the registry and is constrained by workspace trust (read-only set for untrusted folders).
- `previous_response_id`: maintained by `ConversationManager` and passed into each subsequent call for continuity.
- GPT‑5 reasoning/text flags: `reasoning.effort`, `reasoning.summary`, and `text.verbosity` are forwarded directly from configuration helpers.
- Optional encrypted reasoning: enabling it extends the Responses `include` field and forces `store: false` unless explicitly changed.

## Usage accounting

Responses usage `{ input_tokens, output_tokens, total_tokens }` is normalized to `{ prompt_tokens, completion_tokens, total_tokens }` by `OpenAIResponseClient.normalizeUsage` so downstream accounting keeps the Chat-style shape while preserving the original payload.

## Examples

- Minimal server starter: `docs/openai/completions_vs_response-api.md`
- Integration-oriented tests: `buffer-cli/packages/core/src/openai/__tests__/response-client-comprehensive.test.ts`, `buffer-cli/packages/core/src/conversation/__tests__/turn.test.ts`

## Migration notes

- Remove legacy Chat Completions code paths from new logic.
- Prefer `client.responses.create`/`stream` everywhere in the agent loop; use the `OpenAIResponseClient` helpers instead of raw SDK calls.
- In tests, mock `responses.create` or return async iterators of events for streaming flows.
- For follow-ups, pass `function_call_output` entries in `input` and keep `previous_response_id` consistent across rounds.
