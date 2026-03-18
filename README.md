# ScorchCrawl-MCP — MCP Proxy / Server

This repository contains the MCP proxy/server that exposes Model Context Protocol endpoints and bridges MCP clients (VS Code Copilot, Claude Desktop, other clients) to the core `scorchcrawl` scraping engine, plus a CLI client for invoking an already-running MCP HTTP endpoint.

## Design goals

- Small, dependency-light server that can run as a local client-side proxy (`stdio`) or a remote HTTP MCP endpoint (`SSE`).
- Keep per-user secrets (GitHub tokens, NODE_EXTRA_CA_CERTS) local when running `stdio`.
- Use `SCORCHCRAWL_API_URL` to talk to the core scraping engine (can be local or remote).
- Easy-to-install CLI client via npm (`npx scorchcrawl-mcp`) once the MCP server is already reachable over HTTP.

## Quick start — CLI via npm

The npm package is a stdio wrapper around an MCP HTTP server. Start the MCP server first, then point the npm client at it:

```bash
# Terminal 1: run the MCP server itself
SCORCHCRAWL_API_URL=http://localhost:24786 \
HTTP_STREAMABLE_SERVER=true PORT=24787 \
  node server/dist/index.js

# Terminal 2: expose that HTTP MCP server over stdio for your editor/client
SCORCHCRAWL_URL=http://localhost:24787 \
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
| `SCORCHCRAWL_URL` | `http://localhost:24787` | npm client only: URL of the MCP HTTP server |

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
          "SCORCHCRAWL_URL": "http://localhost:24787",
          "GITHUB_TOKEN": "ghp_exampletoken"
        }
      }
    }
  }
}
```

### Ubuntu / WSL stdio example

```json
{
  "scorchcrawl": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "scorchcrawl-mcp"],
    "env": {
      "SCORCHCRAWL_LOCAL_PROXY": "false",
      "SCORCHCRAWL_API_KEY": "${env:SCORCHCRAWL_API_KEY}",
      "SCORCHCRAWL_URL": "http://127.0.0.1:24787",
      "SCORCHCRAWL_API_URL": "${env:SCORCHCRAWL_API_URL}",
      "NODE_EXTRA_CA_CERTS": "/mnt/c/Users/320295634/MCP Configuration/combined-certs.pem"
    },
    "startupTimeout": 300000
  }
}
```

`SCORCHCRAWL_URL` is what the npm client uses to reach the MCP server. `SCORCHCRAWL_API_URL` still belongs to the MCP server process itself, which then talks to the scraping engine.

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
          "SCORCHCRAWL_URL": "http://localhost:24787",
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
  node server/dist/index.js &
sleep 2
curl -sf http://localhost:24787/health && echo "✓ MCP server is healthy"
```

### Windows / WSL helper

When you run the MCP server locally from Windows/WSL it is helpful to keep the scraping traffic and TLS trust bundle on the client machine. Set `SCORCHCRAWL_LOCAL_PROXY=true`, point the MCP server's `SCORCHCRAWL_API_URL` at `http://localhost:24786`, and overlay your Windows CA bundle before launching the server:

```
export SCORCHCRAWL_LOCAL_PROXY=true
export SCORCHCRAWL_API_URL=http://localhost:24786
export NODE_EXTRA_CA_CERTS="/mnt/c/Users/320295634/MCP Configuration/combined-certs.pem"
```

Then point the npm client at the MCP server:

```
export SCORCHCRAWL_URL=http://localhost:24787
npx scorchcrawl-mcp
```

Replace `320295634` with your actual Windows profile path so Node trusts the same CA certificates as the host. The helper script at `./ScorchCrawl/scripts/dev-helper.sh` (relative to the workspace root one level above this README) copies missing `.env` files from the `.env.example`, prints this recommended environment (including a snapshot of `free -h` output so you can see how much RAM is free), and can run whichever unit tests you need once dependencies are installed:

```
./ScorchCrawl/scripts/dev-helper.sh env
./ScorchCrawl/scripts/dev-helper.sh test-mcp
./ScorchCrawl/scripts/dev-helper.sh test-engine
./ScorchCrawl/scripts/dev-helper.sh test-all
```

The npm client now also has dedicated test layers:

```bash
cd client
npm run test:unit
npm run test:integration
npm run test:e2e
```

There is also a lightweight smoke call that mimics your Windows `npx` config on Ubuntu:

```bash
cd client
npm run smoke
```

Keep an eye on RAM before launching the Docker stack — the Compose files currently cap `scorchcrawl-api` at 8 GB and the browser services at 4 GB each, so reduce the `mem_limit` slices if your host has less than ~16 GB.

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
