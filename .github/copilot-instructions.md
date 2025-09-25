# Copilot Instructions for GPT-5 Documentation Repository

## Project Overview

This repository contains comprehensive documentation for OpenAI GPT-5 integration patterns, API migration guides, and prompt optimization workflows. It's primarily a reference collection focused on production-ready GPT-5 implementations and best practices.

## Key Architecture Patterns

### API Strategy: Responses API First
- **Primary Pattern**: Use OpenAI Responses API over Chat Completions for GPT-5
- **Migration Path**: `docs/openai/migrate-to-responses-api.md` contains step-by-step migration guide
- **Why**: Better reasoning persistence, improved tool calling, cleaner semantics for agentic workflows

### GPT-5 Configuration Standards
```typescript
// Standard GPT-5 setup pattern found throughout docs
const response = await openai.responses.create({
  model: "gpt-5",
  input: prompt,
  text: { verbosity: "medium" },
  reasoning: { effort: "medium", summary: "auto" },
  tools: [...],
});
```

### Environment Variable Conventions
Based on `docs/openai/env-vars.md`:
- `OPENAI_API_KEY` (required)
- `OPENAI_MODEL` / `OPENAI_DEFAULT_MODEL` (gpt-5-mini, gpt-5, etc.)
- `OPENAI_VERBOSITY` (low|medium|high)
- `OPENAI_REASONING_EFFORT` (minimal|low|medium|high)
- `OPENAI_USE_RESPONSES_DEFAULT` (enable Responses-first mode)

## Development Workflows

### Prompt Optimization Process
This codebase demonstrates a systematic evaluation approach:

1. **Baseline Testing**: Generate 30+ test runs with initial prompt
2. **Evaluation Scripts**: 
   - `scripts/gen_baseline.py` - Generate baseline results
   - `scripts/topk_eval.py` - Quantitative evaluation
   - `scripts/llm_judge.py` - Qualitative LLM-as-judge evaluation
3. **Optimization**: Use OpenAI Prompt Optimizer tool
4. **Comparative Analysis**: `scripts/results_summarizer.py` for side-by-side metrics

### Testing Patterns
- **Concurrency**: Default to 10 concurrent requests for evaluations
- **Multiple Runs**: Use N_RUNS = 30 for statistical significance
- **Model Defaults**: "gpt-5" for production, "gpt-5-mini" for development

### Code Generation Standards
For agentic coding workflows, prefer:
- **Tool Set 1**: `apply_patch`, `read_file`, `list_files`, `find_matches` (no terminal)
- **Tool Set 2**: `run` command with `session_id` (terminal-native)
- **Never use editor tools - always use `apply_patch`**

## Project-Specific Conventions

### Frontend Stack Recommendations
When generating web applications (from `gpt-5_prompting_guide.md`):
- **Framework**: Next.js (TypeScript)
- **Styling**: Tailwind CSS, shadcn/ui, Radix Themes  
- **Icons**: Material Symbols, Heroicons, Lucide
- **State**: Zustand for state management
- **Directory Structure**: `/src/app`, `/components`, `/hooks`, `/lib`, `/stores`

### Custom Tools Pattern
```javascript
// Standard custom tool definition pattern
{
  "type": "custom", 
  "name": "tool_name",
  "description": "Concise, explicit description"
}
```

### Reasoning Effort Guidelines
- **Minimal**: Fast classification, extraction, formatting (no reasoning tokens)
- **Low**: Simple tasks with some decision-making
- **Medium**: Default for most workflows  
- **High**: Complex planning, multi-step reasoning

## Critical File References

- `docs/openai/migrate-to-responses-api.md` - Complete API migration guide
- `docs/openai/gpt-5_prompting_guide.md` - Comprehensive prompting best practices
- `docs/openai/prompt-optimization-cookbook.md` - Evaluation methodology and examples
- `docs/openai/gpt-5_new_params_and_tools.md` - Latest GPT-5 features and parameters
- `docs/openai/env-vars.md` - Environment configuration reference

## Documentation Standards

- **Code Examples**: Always include both Python and TypeScript/JavaScript versions
- **API Calls**: Show both streaming and non-streaming patterns
- **Error Handling**: Include proper error handling in all examples
- **Performance**: Document token usage, latency considerations, and memory constraints
- **Real-world Context**: Examples use concrete scenarios (weather tools, retail agents, etc.)

## Important Context

This is a **documentation repository**, not a working application. When contributing:
- Focus on accuracy of API usage patterns
- Validate code examples work with latest OpenAI SDK
- Maintain consistency between different documentation files
- Update migration guides when APIs change
- Keep evaluation scripts current with OpenAI model releases