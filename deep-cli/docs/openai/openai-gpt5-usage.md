Using GPT-5
===========

Learn best practices, features, and migration guidance for GPT-5.

Overview
--------

GPT-5 is our most intelligent model yet, trained to be especially proficient in:

*   Code generation, bug fixing, and refactoring
*   Instruction following
*   Long context and tool calling

New API features releasing alongside this model include the ability to control verbosity, a minimal reasoning effort option, custom tools, and an allowed tools list.

This guide walks through some of the key features of the GPT-5 model family and how to get the most out of these models.

Meet the models
---------------

There are three models in the GPT-5 series. In general, `gpt-5` is best for your most complex tasks that require broad world knowledge. The smaller mini and nano models trade off some general world knowledge for lower cost and lower latency. Small models will tend to perform better for more well defined tasks.

To help you pick the model that best fits your use case, consider these tradeoffs:

|Variant|Best for|
|---|---|
|gpt-5|Complex reasoning, broad world knowledge, and code-heavy or multi-step agentic tasks|
|gpt-5-mini|Cost-optimized reasoning and chat; balances speed, cost, and capability|
|gpt-5-nano|High-throughput tasks, especially simple instruction-following or classification|

New API features in GPT-5
-------------------------

Alongside GPT-5, we're introducing a few new parameters and API features designed to give developers more control and flexibility.

### Minimal reasoning effort

The `reasoning.effort` parameter controls how many reasoning tokens the model generates before producing a response. Earlier reasoning models like o3 supported only `low`, `medium`, and `high`: `low` favored speed and fewer tokens, while `high` favored more thorough reasoning.

The new `minimal` setting produces very few reasoning tokens for cases where you need the fastest possible time-to-first-token. We often see better performance when the model can produce a few tokens when needed versus none. The default is `medium`.

The `minimal` setting performs especially well in coding and instruction following scenarios, adhering closely to given directions. However, it may require prompting to act more proactively. To improve the model's reasoning quality, even at minimal effort, encourage it to “think” or outline its steps before answering.

Minimal reasoning effort

```bash
curl --request POST   --url https://api.openai.com/v1/responses   --header "Authorization: Bearer $OPENAI_API_KEY"   --header 'Content-type: application/json'   --data '{
	"model": "gpt-5",
	"input": "How much gold would it take to coat the Statue of Liberty in a 1mm layer?",
	"reasoning": {
		"effort": "minimal"
	}
}'
```

```javascript
import OpenAI from "openai";
const openai = new OpenAI();

const response = await openai.responses.create({
  model: "gpt-5",
  input: "How much gold would it take to coat the Statue of Liberty in a 1mm layer?",
  reasoning: {
    effort: "minimal"
  }
});

console.log(response);
```

```python
from openai import OpenAI
client = OpenAI()

response = client.responses.create(
    model="gpt-5",
    input="How much gold would it take to coat the Statue of Liberty in a 1mm layer?",
    reasoning={
        "effort": "minimal"
    }
)

print(response)
```

### Verbosity

Verbosity determines how many output tokens are generated. Lowering the number of tokens reduces overall latency. While the model's reasoning approach stays mostly the same, the model finds ways to answer more concisely—which can either improve or diminish answer quality, depending on your use case. Here are some scenarios for both ends of the verbosity spectrum:

*   **High verbosity:** Use when you need the model to provide thorough explanations of documents or perform extensive code refactoring.
*   **Low verbosity:** Best for situations where you want concise answers or simple code generation, such as SQL queries.

Models before GPT-5 have used `medium` verbosity by default. With GPT-5, we make this option configurable as one of `high`, `medium`, or `low`.

When generating code, `medium` and `high` verbosity levels yield longer, more structured code with inline explanations, while `low` verbosity produces shorter, more concise code with minimal commentary.

Control verbosity

```bash
curl --request POST   --url https://api.openai.com/v1/responses   --header "Authorization: Bearer $OPENAI_API_KEY"   --header 'Content-type: application/json'   --data '{
  "model": "gpt-5",
  "input": "What is the answer to the ultimate question of life, the universe, and everything?",
  "text": {
    "verbosity": "low"
  }
}'
```

```javascript
import OpenAI from "openai";
const openai = new OpenAI();

const response = await openai.responses.create({
  model: "gpt-5",
  input: "What is the answer to the ultimate question of life, the universe, and everything?",
  text: {
    verbosity: "low"
  }
});

console.log(response);
```

```python
from openai import OpenAI
client = OpenAI()

response = client.responses.create(
    model="gpt-5",
    input="What is the answer to the ultimate question of life, the universe, and everything?",
    text={
        "verbosity": "low"
    }
)

print(response)
```

You can still steer verbosity through prompting after setting it to `low` in the API. The verbosity parameter defines a general token range at the system prompt level, but the actual output is flexible to both developer and user prompts within that range.

### Custom tools

With GPT-5, we're introducing a new capability called custom tools, which lets models send any raw text as tool call input but still constrain outputs if desired.

[

Function calling guide

Learn about custom tools in the function calling guide.

](/docs/guides/function-calling)

#### Freeform inputs

Define your tool with `type: custom` to enable models to send plaintext inputs directly to your tools, rather than being limited to structured JSON. The model can send any raw text—code, SQL queries, shell commands, configuration files, or long-form prose—directly to your tool.

```bash
{
    "type": "custom",
    "name": "code_exec",
    "description": "Executes arbitrary python code",
}
```

#### Constraining outputs

GPT-5 supports context-free grammars (CFGs) for custom tools, letting you provide a Lark grammar to constrain outputs to a specific syntax or DSL. Attaching a CFG (e.g., a SQL or DSL grammar) ensures the assistant's text matches your grammar.

This enables precise, constrained tool calls or structured responses and lets you enforce strict syntactic or domain-specific formats directly in GPT-5's function calling, improving control and reliability for complex or constrained domains.

#### Best practices for custom tools

*   **Write concise, explicit tool descriptions**. The model chooses what to send based on your description; state clearly if you want it to always call the tool.
*   **Validate outputs on the server side**. Freeform strings are powerful but require safeguards against injection or unsafe commands.

### Allowed tools

The `allowed_tools` parameter under `tool_choice` in the GPT-5 Responses API lets you pass N tool definitions but restrict the model to only M (< N) of them. List your full toolkit in `tools`, and then use an `allowed_tools` block to name the subset and specify a mode—either `auto` (the model may pick any of those) or `required` (the model must invoke one).

[

Function calling guide

Learn about the allowed tools option in the function calling guide.

](/docs/guides/function-calling)

By separating all possible tools from the subset that can be used _now_, you gain greater safety, predictability, and improved prompt caching. You also avoid brittle prompt engineering, such as hard-coded call order. GPT-5 dynamically invokes or requires specific functions mid-conversation while reducing the risk of unintended tool usage over long contexts.

||Standard Tools|Allowed Tools|
|---|---|---|
|Model's universe|All tools listed under "tools": […]|Only the subset under "tools": […] in tool_choice|
|Tool invocation|Model may or may not call any tool|Model restricted to (or required to call) chosen tools|
|Purpose|Declare available capabilities|Constrain which capabilities are actually used|

```bash
"tool_choice": {
    "type": "allowed_tools",
    "mode": "auto",
    "tools": [
      { "type": "function", "name": "get_weather" },
      { "type": "mcp", "server_label": "deepwiki" },
      { "type": "image_generation" }
    ]
  }
```

Convenience in Fiber
--------------------

- You can constrain tool usage at runtime via env: set FIBER_ALLOWED_TOOLS as a comma-separated list.
  - Example: FIBER_ALLOWED_TOOLS=read_file,search_code
  - Fiber will pass these through as tool_choice: { type: "allowed_tools", mode: "auto", tools: [...] } on both Chat and Responses paths. When the run forces tools, mode becomes "required".

Post-tool reflection behavior
-----------------------------

Fiber appends a concise reflection checklist after each tool execution round in a turn to drive predictable, efficient finishing:

- Reflect (concise):
  1) Did outputs satisfy the plan?
  2) What’s the next minimal action?
  3) Ready to finalize? If yes, finalize with minimal extra steps.

This aligns with GPT‑5 guidance on reflection and reduces unnecessary additional tool calls or verbose wandering.

Preambles
---------

Preambles are brief, user-visible explanations that GPT-5 generates before invoking any tool or function, outlining its intent or plan (e.g., “why I'm calling this tool”). They appear after the chain-of-thought and before the actual tool call, providing transparency into the model's reasoning and enhancing debuggability, user confidence, and fine-grained steerability.

By letting GPT-5 “think out loud” before each tool call, preambles boost tool-calling accuracy (and overall task success) without bloating reasoning overhead. To enable preambles, add a system or developer instruction—for example: “Before you call a tool, explain why you are calling it.” GPT-5 prepends a concise rationale to each specified tool call. The model may also output multiple messages between tool calls, which can enhance the interaction experience—particularly for minimal reasoning or latency-sensitive use cases.

For a more detailed overview of all of these new features, see the [accompanying cookbook](https://cookbook.openai.com/examples/gpt-5/gpt-5_new_params_and_tools).

Migration guidance
------------------

GPT-5 is our best model yet, and it works best with the Responses API, which supports for passing chain of thought (CoT) between turns. Read below to migrate from your current model or API.

### Migrating from other models to GPT-5

We see improved intelligence because the Responses API can pass the previous turn's CoT to the model. This leads to fewer generated reasoning tokens, higher cache hit rates, and less latency. To learn more, see an [in-depth guide](https://cookbook.openai.com/examples/responses_api/reasoning_items) on the benefits of responses.

When migrating to GPT-5 from an older OpenAI model, start by experimenting with reasoning levels and prompting strategies. Based on our testing, we recommend using our [prompt optimizer](http://platform.openai.com/chat/edit?optimize=true)—which automatically updates your prompts for GPT-5 based on our best practices—and following this model-specific guidance:

*   **o3**: `gpt-5` with `medium` or `high` reasoning is a great replacement. Start with `medium` reasoning with prompt tuning, then increasing to `high` if you aren't getting the results you want.
*   **gpt-4.1**: `gpt-5` with `minimal` or `low` reasoning is a strong alternative. Start with `minimal` and tune your prompts; increase to `low` if you need better performance.
*   **o4-mini or gpt-4.1-mini**: `gpt-5-mini` with prompt tuning is a great replacement.
*   **gpt-4.1-nano**: `gpt-5-nano` with prompt tuning is a great replacement.

### Migrating from Chat Completions to Responses API

The biggest difference, and main reason to migrate from Chat Completions to the Responses API for GPT-5, is support for passing chain of thought (CoT) between turns. See a full [comparison of the APIs](/docs/guides/responses-vs-chat-completions).

Passing CoT exists only in the Responses API, and we've seen improved intelligence, fewer generated reasoning tokens, higher cache hit rates, and lower latency as a result of doing so. Most other parameters remain at parity, though the formatting is different. Here's how new parameters are handled differently between Chat Completions and the Responses API:

**Reasoning effort**

Responses API

Generate response with minimal reasoning

```json
curl --request POST \
--url https://api.openai.com/v1/responses \
--header "Authorization: Bearer $OPENAI_API_KEY" \
--header 'Content-type: application/json' \
--data '{
  "model": "gpt-5",
  "input": "How much gold would it take to coat the Statue of Liberty in a 1mm layer?",
  "reasoning": {
    "effort": "minimal"
  }
}'
```

Chat Completions

Generate response with minimal reasoning

```json
curl --request POST \
--url https://api.openai.com/v1/chat/completions \
--header "Authorization: Bearer $OPENAI_API_KEY" \
--header 'Content-type: application/json' \
--data '{
  "model": "gpt-5",
  "messages": [
    {
      "role": "user",
      "content": "How much gold would it take to coat the Statue of Liberty in a 1mm layer?"
    }
  ],
  "reasoning_effort": "minimal"
}'
```

**Verbosity**

Responses API

Control verbosity

```json
curl --request POST \
--url https://api.openai.com/v1/responses \
--header "Authorization: Bearer $OPENAI_API_KEY" \
--header 'Content-type: application/json' \
--data '{
  "model": "gpt-5",
  "input": "What is the answer to the ultimate question of life, the universe, and everything?",
  "text": {
    "verbosity": "low"
  }
}'
```

Chat Completions

Control verbosity

```json
curl --request POST \
--url https://api.openai.com/v1/chat/completions \
--header "Authorization: Bearer $OPENAI_API_KEY" \
--header 'Content-type: application/json' \
--data '{
  "model": "gpt-5",
  "messages": [
    { "role": "user", "content": "What is the answer to the ultimate question of life, the universe, and everything?" }
  ],
  "verbosity": "low"
}'
```

**Custom tools**

Responses API

Custom tool call

```json
curl --request POST --url https://api.openai.com/v1/responses --header "Authorization: Bearer $OPENAI_API_KEY" --header 'Content-type: application/json' --data '{
  "model": "gpt-5",
  "input": "Use the code_exec tool to calculate the area of a circle with radius equal to the number of r letters in blueberry",
  "tools": [
    {
      "type": "custom",
      "name": "code_exec",
      "description": "Executes arbitrary python code"
    }
  ]
}'
```

Chat Completions

Custom tool call

```json
curl --request POST --url https://api.openai.com/v1/chat/completions --header "Authorization: Bearer $OPENAI_API_KEY" --header 'Content-type: application/json' --data '{
  "model": "gpt-5",
  "messages": [
    { "role": "user", "content": "Use the code_exec tool to calculate the area of a circle with radius equal to the number of r letters in blueberry" }
  ],
  "tools": [
    {
      "type": "custom",
      "custom": {
        "name": "code_exec",
        "description": "Executes arbitrary python code"
      }
    }
  ]
}'
```

Prompting guidance
------------------

We specifically designed GPT-5 to excel at coding, frontend engineering, and tool-calling for agentic tasks. We also recommend iterating on prompts for GPT-5 using the [prompt optimizer](/chat/edit?optimize=true).

[

GPT-5 prompt optimizer

Craft the perfect prompt for GPT-5 in the dashboard

](/chat/edit?optimize=true)[

GPT-5 prompting guide

Learn full best practices for prompting GPT-5 models

](https://cookbook.openai.com/examples/gpt-5/gpt-5_prompting_guide)[

Frontend prompting for GPT-5

See prompt samples specific to frontend development

](https://cookbook.openai.com/examples/gpt-5_frontend)

### GPT-5 is a reasoning model

Reasoning models like GPT-5 break problems down step by step, producing an internal chain of thought that encodes their reasoning. To maximize performance, pass these reasoning items back to the model: this avoids re-reasoning and keeps interactions closer to the model's training distribution. In multi-turn conversations, passing a `previous_response_id` automatically makes earlier reasoning items available. This is especially important when using tools—for example, when a function call requires an extra round trip. In these cases, either include them with `previous_response_id` or add them directly to `input`.

Learn more about reasoning models and how to get the most out of them in our [reasoning guide](/docs/guides/reasoning).

Further reading
---------------

[GPT-5 prompting guide](https://cookbook.openai.com/examples/gpt-5/gpt-5_prompting_guide)

[GPT-5 frontend guide](https://cookbook.openai.com/examples/gpt-5/gpt-5_frontend)

[GPT-5 new features guide](https://cookbook.openai.com/examples/gpt-5/gpt-5_new_params_and_tools)

[Cookbook on reasoning models](https://cookbook.openai.com/examples/responses_api/reasoning_items)

[Comparison of Responses API versus Chat Completions](https://www.notion.so/GPT-5-Docs-Draft-2418e50b62b0800f8e86e2ee0d9f3b69?pvs=21)

FAQ
---

1.  **How are these models integrated into ChatGPT?**

    In ChatGPT, there are two models: `gpt-5-chat` and `gpt-5-thinking`. They offer reasoning and minimal-reasoning capabilities, with a routing layer that selects the best model based on the user's question. Users can also invoke reasoning directly through the ChatGPT UI.

2.  **Will these models be supported in Codex?**

    Yes, `gpt-5` will be available in Codex and Codex CLI.

3.  **What is the deprecation plan for previous models?**

    Any model deprecations will be posted on our [deprecations page](/docs/deprecations#page-top). We'll send advanced notice of any model deprecations.




Streaming + Tools (Responses API)
---------------------------------

Fiber supports streaming with the Responses API, including parsing streamed tool-calls and executing tools, with a clean UI experience.

- Enable via environment flags:
  - `OPENAI_USE_RESPONSES_DEFAULT=true` (Responses-first)
  - `OPENAI_STREAM=true` (enable streaming)
- Model guidance:
  - Use a Responses-capable model for tool calling (e.g., `gpt-4.1-mini`).
  - Only pass GPT‑5 specific fields (`reasoning_effort`, `verbosity`) when using GPT‑5 models.
- UX:
  - Output streams progressively into the Ink UI.
  - Press ESC to cancel a long streaming turn; partial output remains visible.

What Fiber does when streaming with Responses
- Initial call: `responses.create({ stream: true, model, input: messages, tools, max_output_tokens })`
  - Handles streamed events:
    - `response.output_text.delta` → appended to UI in real time
    - Tool/function deltas → accumulated per `call_id` (function name and arguments)
  - Captures `previous_response_id` from stream metadata
- If the model called tools, Fiber executes them and posts a follow-up Responses request:
  - `responses.create({ stream: true, previous_response_id, input: [{ type: "function_call_output", call_id, output }], tools, model, max_output_tokens })`
  - Streams the follow-up output and accumulates any additional tool calls
  - Iterates until no more tool calls are requested or turn bounds are reached
- Fallbacks:
  - If a streaming error occurs, Fiber falls back to non-streaming Responses, then to Chat Completions

Follow-up iteration configuration
---------------------------------

Fiber performs iterative Responses follow-ups after tool execution within a turn. You can tune the iteration behavior and logging:

- responsesFollowupMaxRounds (default: 3; clamped 1–10)
  - Caps the number of follow-up iterations in a single turn
  - Example: set to 1 to perform only a single follow-up round per turn
- responsesDebugLogging (default: false)
  - Enables verbose follow-up parameter logs on each round, even if `OPENAI_LOG_PATHS` is not set
  - Logged fields include: `round`, `maxRounds`, `previous_response_id` presence, `tool_choice`, `include`, `store`, and `reasoning`

Example enabling both in code:

```ts
const loop = new AgenticExecutionLoop(client, {
  useResponsesByDefault: true,
  enableStreaming: true,
  responsesFollowupMaxRounds: 2,
  responsesDebugLogging: true,
}, uiManager, toolManager);
```

Behavior notes
- If a follow-up stream returns final text and no further tool calls, Fiber finalizes the turn immediately with success.
- Fiber captures `previous_response_id` from the stream (or preserves it when not emitted), and continues to pass it on subsequent requests for improved CoT continuity.
- Only attach GPT‑5 steering fields (`reasoning.effort`, `text.verbosity`) when using GPT‑5 models.

Quick smoke tests
- Build the project: `npm run build`
- Basic streaming + tools:

```
OPENAI_USE_RESPONSES_DEFAULT=true OPENAI_STREAM=true node scripts/smoke-responses-tools.mjs
```

- Follow-up handoff (Phase 4):
```
OPENAI_USE_RESPONSES_DEFAULT=true OPENAI_STREAM=true node scripts/smoke-responses-followup.mjs
```

Expected output includes something like:

```
[responses-followup-smoke] Starting follow-up streaming tool-call test...
[responses-followup-smoke] success= true toolCallsExecuted= 2
[responses-followup-smoke] finalOutput prefix= All set.
[responses-followup-smoke] SUCCESS
```

Troubleshooting
- 400 Unrecognized request arguments: Ensure `reasoning_effort` and `verbosity` are only sent with GPT‑5 models
- Empty stream or no tool calls: Use a model that supports tool calling with Responses (e.g., `gpt-4.1-mini`)
- Follow-up not triggered: Verify the initial stream emits tool calls and that `__previous_response_id` is captured; check OPENAI_LOG_PATHS=true for event logs
- Cancel not working: Confirm you’re in the Fiber Ink UI and press ESC during streaming; logs should show STOP_REQUESTED handling

Was this page useful?