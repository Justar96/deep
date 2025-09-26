# Fiber OpenAI-related environment variables

Set these in your .env. All are optional unless noted.

Core
- OPENAI_API_KEY (required): API key
- OPENAI_MODEL / OPENAI_DEFAULT_MODEL: default model (e.g., gpt-5-mini, o4-mini-2025-04-16)
- OPENAI_BASE_URL: override base URL

Responses API behavior
- OPENAI_USE_RESPONSES_DEFAULT=true|false: enable Responses-first mode in main loop
- OPENAI_USE_RESPONSES_FALLBACK=true|false: try Responses before falling back
- OPENAI_STREAM=true|false: enable streaming
- OPENAI_LOG_PATHS=true|false: log parameter snapshots and event types (debug)

GPT‑5 steering (defaulted from code if unset)
- OPENAI_VERBOSITY=low|medium|high
- OPENAI_REASONING_EFFORT=minimal|low|medium|high

Tool access control
- FIBER_ALLOWED_TOOLS="read_file,write_file,list_directory": limit tools via allowed_tools

Responses advanced features
- OPENAI_RESP_ENABLE_SUMMARY=true|false: add reasoning.summary='auto'
- OPENAI_RESP_INCLUDE_ENCRYPTED=true|false: include=['reasoning.encrypted_content'] (disables store by default)
- OPENAI_RESP_STORE=true|false: force store on/off (overrides the default when encrypted is enabled)

Other
- NODE_ENV=development|production|test: affects debug and dotenv loading

