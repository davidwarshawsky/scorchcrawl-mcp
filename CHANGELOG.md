# Changelog

## 2.1.0 - 2026-03-18

- **Removed `@github/copilot-sdk` dependency entirely.** This fixes the Windows `ERR_MODULE_NOT_FOUND` crash (`vscode-jsonrpc/node`) and stops consuming GitHub Enterprise API rate limits.
- Removed the optional AI summarization feature that relied on the Copilot SDK. Content truncation (smart paragraph-boundary truncation) remains fully functional.
- Removed `GITHUB_TOKEN`, `x-copilot-token`, and `x-github-token` header handling from the MCP server.
- Removed the `postinstall` patch script that attempted to work around the SDK's broken ESM import.

## 2.0.1 - 2026-03-18

- Patched the Copilot SDK runtime import on install so Windows `npx scorchcrawl-mcp` works under current Node/npm resolution behavior.

## 2.0.0 - 2026-03-18

- Removed the public agentic MCP tool surface (`scorch_agent`, status, models, and rate-limit endpoints).
- Kept API-key-aware content summarization support for long scrape responses.
- Made the `scorchcrawl-mcp` Docker Compose service opt-in via the `mcp` profile so the default deployment starts only the engine stack.
- Removed the dedicated agent runtime and rate-limiter code paths that were only used by the removed agentic tools.
