# Changelog

## 2.0.0 - 2026-03-18

- Removed the public agentic MCP tool surface (`scorch_agent`, status, models, and rate-limit endpoints).
- Kept API-key-aware content summarization support for long scrape responses.
- Made the `scorchcrawl-mcp` Docker Compose service opt-in via the `mcp` profile so the default deployment starts only the engine stack.
- Removed the dedicated agent runtime and rate-limiter code paths that were only used by the removed agentic tools.
