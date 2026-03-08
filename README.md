# ScorchCrawl-MCP — MCP Proxy / Server

This repository contains the MCP proxy/server that exposes Model Context Protocol endpoints and bridges MCP clients (VS Code Copilot, Claude Desktop, other clients) to the core `scorchcrawl` scraping engine, plus a CLI client for invoking the server.

## Design goals

- Small, dependency-light server that can run as a local client-side proxy (`stdio`) or a remote HTTP MCP endpoint (`SSE`).
- Keep per-user secrets (GitHub tokens, NODE_EXTRA_CA_CERTS) local when running `stdio`.
- Use `SCORCHCRAWL_API_URL` to talk to the core scraping engine (can be local or remote).
- Easy-to-install CLI client via npm (`npx scorchcrawl-mcp`).

## Quick start — CLI via npm (recommended)

The simplest way to run the MCP server locally is:

```bash
# Install and run as stdio server (default mode)
npx scorchcrawl-mcp

# Or set environment variables for HTTP server mode
SCORCHCRAWL_API_URL=http://localhost:24786 \
HTTP_STREAMABLE_SERVER=true PORT=24787 \
npx scorchcrawl-mcp
```

## Quick start — Local HTTP (SSE) server

```bash
# Build and run the server directly from source
cd server
pnpm install
pnpm build

# Run as HTTP MCP server
HTTP_STREAMABLE_SERVER=true PORT=24787 SCORCHCRAWL_API_URL=http://localhost:24786 \
  node dist/index.js
```

## Quick start — Full-stack deployment (Docker Compose)

For a complete deployment with both the scraping engine and MCP server:

```bash
docker compose up -d
```

This brings up:
- **scorchcrawl-api** (engine) on port 24786
- **scorchcrawl-mcp** (MCP server) on port 24787
- Supporting services (Redis, RabbitMQ, Postgres, Playwright, Browserless, SearXNG)

See `.env.example` for all configurable variables.

## Configuration

| Variable | Default | Notes |
|----------|---------|-------|
| `SCORCHCRAWL_API_URL` | — | Required: URL of the scraping API (e.g. `http://localhost:24786`) |
| `SCORCHCRAWL_API_KEY` | — | Optional: API key for authentication to the engine |
| `GITHUB_TOKEN` | — | Optional: GitHub PAT with `copilot` scope for Copilot agent |
| `HTTP_STREAMABLE_SERVER` | `false` | Set to `true` to run as HTTP server instead of stdio |
| `PORT` | `3000` | Server port |
| `NODE_EXTRA_CA_CERTS` | — | Optional: CA bundle path for TLS validation (Windows clients) |

## Client configuration

### Using npm (cli/stdio)

```json
{
  "mcp": {
    "servers": {
      "scorchcrawl": {
        "type": "stdio",
        "command": "npx",
        "args": ["scorchcrawl-mcp"],
        "env": {
          "SCORCHCRAWL_API_URL": "http://localhost:24786",
          "GITHUB_TOKEN": "ghp_exampletoken"
        }
      }
    }
  }
}
```

### Using local source

```json
{
  "mcp": {
    "servers": {
      "scorchcrawl": {
        "type": "stdio",
        "command": "node",
        "args": ["/path/to/scorchcrawl-mcp/client/dist/cli.js"],
        "env": {
          "SCORCHCRAWL_API_URL": "http://localhost:24786",
          "GITHUB_TOKEN": "ghp_exampletoken"
        }
      }
    }
  }
}
```

## Smoke test

```bash
# Test the health endpoint (server running with HTTP mode)
HTTP_STREAMABLE_SERVER=true PORT=24787 SCORCHCRAWL_API_URL=http://localhost:24786 \
  npx scorchcrawl-mcp &
sleep 2
curl -sf http://localhost:24787/health && echo "✓ MCP server is healthy"
```

## Getting the core scraping engine

See the companion `scorchcrawl` repository:
- **Repository**: [davidwarshawsky/scorchcrawl](https://github.com/davidwarshawsky/scorchcrawl)
- **Docker image**: `docker pull ananymoususer/scorchcrawl:latest`
- For configuration, deployment, and architecture docs, see `docs/` in that repo

## Publishing to npm

The CLI client (`client/package.json`) is published to npm as `scorchcrawl-mcp`:

```bash
npm publish
```

This enables users to install and run via:
```bash
npx scorchcrawl-mcp
npm install -g scorchcrawl-mcp
```

## License

AGPL-3.0 — see `LICENSE`.

The MCP server layer (`server/`), client package (`client/`), and Docker orchestration are original work by ScorchCrawl Contributors, also licensed under AGPL-3.0.

**Trademark Notice:** "Firecrawl" is a trademark of Mendable/Sideguide Technologies Inc. "ScorchCrawl" is NOT affiliated with, endorsed by, or sponsored by Firecrawl or Mendable/Sideguide Technologies Inc.

## Disclaimer

THIS SOFTWARE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND. THE AUTHORS AND COPYRIGHT HOLDERS DISCLAIM ALL LIABILITY FOR ANY DAMAGES ARISING FROM THE USE OF THIS SOFTWARE. USERS ASSUME ALL RISK AND RESPONSIBILITY FOR COMPLIANCE WITH APPLICABLE LAWS AND REGULATIONS. THIS SOFTWARE MUST NOT BE USED FOR ANY ILLEGAL ACTIVITY, UNAUTHORIZED ACCESS, OR IN VIOLATION OF ANY WEBSITE'S TERMS OF SERVICE.
