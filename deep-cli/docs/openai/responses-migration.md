# Migrating to Responses-only architecture

This codebase now uses OpenAI's Responses API exclusively for agentic execution. Chat Completions paths were removed from the agentic loop. This guide explains what's changed and how to integrate with the OpenAIAgentEngine + Turn + OpenAIResponseClient stack.

## What changed

- LLM calls now flow through `OpenAIAgentEngine` → `Turn` → `OpenAIResponseClient` → `client.responses`
- Chat Completions endpoints were fully removed from the execution loop
- Tool invocation follows the Responses `function_call`/`function_call_output` handoff handled within `Turn`
- Responses streaming events feed UI updates directly (`response.output_text.delta`, `response.function_call_arguments.delta`, etc.)
- Usage from Responses `{input_tokens, output_tokens, total_tokens}` is normalized to `{prompt_tokens, completion_tokens, total_tokens}` for downstream accounting
- GPT‑5 options such as reasoning summary, effort, text verbosity, and encrypted reasoning are forwarded when configured

## How to call the model now

`OpenAIAgentEngine.processMessage` / `processMessageStream` create a `Turn` that prepares the workspace context and kicks off the initial Responses call:

```ts
const turn = new Turn(responseClient, config, promptId, conversationContext);
for await (const event of turn.run(
  config.getModel(),
  userMessage,
  abortSignal,
  conversation.metadata.lastResponseId,
)) {
  handle(event);
}
```

When the model returns tool calls, `Turn` executes them through the tool registry and issues a follow-up:

```ts
const followup = await responseClient.followupResponse({
  model,
  previousResponseId: currentResponse.id,
  input: toolResults, // array of { type: 'function_call_output', call_id, output }
  tools: registryTools,
  toolChoice,
  reasoning,
  text,
});
```

## Allowed tools and tool_choice

- `Turn` uses the tool registry to build the Responses tool array and a `tool_choice` object.
- The registry filters tools based on workspace trust: untrusted folders get a read-only set (`read-file`, `ls`, `grep`, `ripGrep`, `glob`), trusted workspaces get the full list including write/edit/shell.
- The current implementation always emits `tool_choice: { type: 'allowed_tools', mode: 'auto', tools: [...] }`. A `required` mode can be added later if we introduce a per-request `forceTools` signal.

## Reasoning and verbosity flags (GPT‑5)

If you enable these via `llm.setConfig`, they propagate to Responses params:

- `enableReasoningSummary` → `reasoning.summary = 'auto'`
- `reasoningEffort` → `reasoning.effort = 'minimal' | 'low' | 'medium' | 'high'`
- `verbosity` → `text.verbosity = 'low' | 'medium' | 'high'`
- `includeEncryptedReasoning` adds `include: ['reasoning.encrypted_content']` and defaults `store: false` unless overridden

## Usage normalization

Responses usage `{ input_tokens, output_tokens, total_tokens }` is normalized by `OpenAIResponseClient.normalizeUsage` to a Chat-like shape:

```ts
{
  usage: {
    prompt_tokens: input_tokens,
    completion_tokens: output_tokens,
    total_tokens
  }
}
```

This keeps downstream accounting consistent without mixing different usage field names.

## Testing guidance

- Prefer stubbing `client.responses.create` in tests
- For streaming tests, return an async iterator of events and assert `onEvent` and UI hooks
- For follow-up, assert `input` contains `function_call_output` entries and that `tool_choice` is present when `allowedTools` are set

## Migration checklist

- [x] Remove Chat Completions calls from the loop
- [x] Route all model calls through `OpenAIAgentEngine`/`Turn`/`OpenAIResponseClient`
- [x] Update tests to mock `client.responses.create`
- [x] Validate allowed tools mapping and usage normalization
- [x] Verify streaming follow-up and STOP_REQUESTED handling

## Examples and references

- See `buffer-cli/packages/core/src/openai/__tests__/response-client-comprehensive.test.ts` for integration examples
- See `buffer-cli/packages/core/src/conversation/__tests__/turn.test.ts` for turn-level loop coverage
- See `docs/openai/completions_vs_response-api.md` for a standalone Responses starter
