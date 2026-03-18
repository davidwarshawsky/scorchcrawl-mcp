#!/usr/bin/env node

/**
 * scorchcrawl-mcp CLI
 *
 * A thin wrapper that connects to a ScorchCrawl server and exposes its MCP
 * tools over stdio transport. This lets MCP clients (VS Code, Copilot CLI,
 * etc.) use a remote ScorchCrawl server as if it were a local MCP server.
 *
 * Usage:
 *   SCORCHCRAWL_URL=http://localhost:24787 scorchcrawl-mcp
 *
 * Or with a remote server + API key:
 *   SCORCHCRAWL_URL=https://your-server.com/mcp-api/scorchcrawl/YOUR_KEY scorchcrawl-mcp
 *
 * Environment variables:
 *   SCORCHCRAWL_URL          - Base URL of the ScorchCrawl MCP server (required)
 *   GITHUB_TOKEN             - GitHub PAT for Copilot SDK agent (optional, sent as x-copilot-token)
 *   SCORCHCRAWL_LOCAL_PROXY  - Set to "true" to route scraping through your local IP
 */

import { pathToFileURL } from 'url';

async function loadDotenv(): Promise<void> {
  try {
    const dotenv = await import('dotenv');
    dotenv.config({ quiet: true });
  } catch {
    // Allow direct source execution in constrained environments.
  }
}

const DEFAULT_MCP_URL = 'http://localhost:24787';

export interface CliEnv {
  SCORCHCRAWL_URL?: string;
  SCORCHCRAWL_API_URL?: string;
  GITHUB_TOKEN?: string;
  SCORCHCRAWL_LOCAL_PROXY?: string;
}

export interface ResolvedServerConfig {
  serverBaseUrl: string;
  source: 'default' | 'SCORCHCRAWL_URL' | 'SCORCHCRAWL_API_URL';
  warnings: string[];
}

interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
  id?: string | number;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
  id?: string | number;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function normalizeServerBaseUrl(value: string): string {
  const trimmed = trimTrailingSlash(value.trim());
  if (!trimmed) {
    return DEFAULT_MCP_URL;
  }

  if (trimmed.endsWith('/mcp')) {
    return trimmed.slice(0, -4);
  }

  return trimmed;
}

function deriveLocalMcpUrl(apiUrl: URL): string | null {
  const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
  if (!localHosts.has(apiUrl.hostname)) {
    return null;
  }

  if (apiUrl.port === '24786') {
    const derived = new URL(apiUrl.toString());
    derived.port = '24787';
    derived.pathname = '';
    derived.search = '';
    derived.hash = '';
    return normalizeServerBaseUrl(derived.toString());
  }

  return null;
}

export function resolveServerConfig(env: CliEnv = process.env): ResolvedServerConfig {
  const warnings: string[] = [];
  const directUrl = env.SCORCHCRAWL_URL?.trim();
  if (directUrl) {
    return {
      serverBaseUrl: normalizeServerBaseUrl(directUrl),
      source: 'SCORCHCRAWL_URL',
      warnings,
    };
  }

  const apiUrlValue = env.SCORCHCRAWL_API_URL?.trim();
  if (!apiUrlValue) {
    return {
      serverBaseUrl: DEFAULT_MCP_URL,
      source: 'default',
      warnings,
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(apiUrlValue);
  } catch {
    throw new Error(
      `Invalid SCORCHCRAWL_API_URL: ${apiUrlValue}. Set SCORCHCRAWL_URL to your MCP server URL instead.`
    );
  }

  if (parsed.port === '24787' || parsed.pathname.endsWith('/mcp')) {
    warnings.push(
      'SCORCHCRAWL_API_URL is being used as an MCP endpoint alias. Prefer SCORCHCRAWL_URL for the npm client.'
    );
    return {
      serverBaseUrl: normalizeServerBaseUrl(apiUrlValue),
      source: 'SCORCHCRAWL_API_URL',
      warnings,
    };
  }

  const derivedLocalUrl = deriveLocalMcpUrl(parsed);
  if (derivedLocalUrl) {
    warnings.push(
      `SCORCHCRAWL_API_URL points to the scraping engine (${apiUrlValue}). The npm client needs the MCP server, so it will use ${derivedLocalUrl} instead.`
    );
    return {
      serverBaseUrl: derivedLocalUrl,
      source: 'SCORCHCRAWL_API_URL',
      warnings,
    };
  }

  throw new Error(
    `SCORCHCRAWL_API_URL points to the scraping engine (${apiUrlValue}), not the MCP server. Set SCORCHCRAWL_URL to the MCP endpoint, for example http://localhost:24787.`
  );
}

export function isLocalProxyEnabled(env: CliEnv = process.env): boolean {
  return env.SCORCHCRAWL_LOCAL_PROXY === 'true';
}

/**
 * Forward a JSON-RPC request to the remote ScorchCrawl server.
 */
export async function forwardToServer(
  request: JsonRpcRequest,
  serverBaseUrl: string,
  githubToken?: string,
): Promise<JsonRpcResponse> {
  const url = `${serverBaseUrl}/mcp`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
  };

  if (githubToken) {
    headers['x-copilot-token'] = githubToken;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    const text = await response.text();

    // Handle SSE responses (event: message\ndata: {...})
    if (text.startsWith('event:') || text.startsWith('data:')) {
      const dataLine = text.split('\n').find(l => l.startsWith('data:'));
      if (dataLine) {
        return JSON.parse(dataLine.slice(5).trim());
      }
    }

    // Handle direct JSON responses
    if (text.trim().startsWith('{')) {
      return JSON.parse(text);
    }

    return {
      jsonrpc: '2.0',
      error: { code: -32603, message: `Unexpected response: ${text.substring(0, 200)}` },
      id: request.id,
    };
  } catch (err: any) {
    return {
      jsonrpc: '2.0',
      error: { code: -32603, message: `Connection failed: ${err.message}` },
      id: request.id,
    };
  }
}

/**
 * Read JSON-RPC messages from stdin and forward to the server.
 */
async function main(): Promise<void> {
  await loadDotenv();
  const { serverBaseUrl, warnings } = resolveServerConfig(process.env);
  const githubToken = process.env.GITHUB_TOKEN;
  const localProxy = isLocalProxyEnabled(process.env);

  if (!serverBaseUrl || serverBaseUrl === DEFAULT_MCP_URL) {
    process.stderr.write(
      `[scorchcrawl-mcp] Connecting to ${serverBaseUrl}\n` +
      `[scorchcrawl-mcp] Set SCORCHCRAWL_URL to change the server address\n`
    );
  } else {
    process.stderr.write(`[scorchcrawl-mcp] Connecting to ${serverBaseUrl}\n`);
  }

  for (const warning of warnings) {
    process.stderr.write(`[scorchcrawl-mcp] ${warning}\n`);
  }

  if (localProxy) {
    process.stderr.write('[scorchcrawl-mcp] Local proxy mode: ON (scraping through your IP)\n');
    process.stderr.write(
      '[scorchcrawl-mcp] Note: this only works when the MCP server itself is running on this machine.\n'
    );
  }

  // Read from stdin line by line
  let buffer = '';

  process.stdin.setEncoding('utf8');
  process.stdin.on('data', async (chunk: string) => {
    buffer += chunk;

    // Process complete lines
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const request: JsonRpcRequest = JSON.parse(trimmed);
        const response = await forwardToServer(request, serverBaseUrl, githubToken);
        process.stdout.write(JSON.stringify(response) + '\n');
      } catch (err: any) {
        const errorResponse: JsonRpcResponse = {
          jsonrpc: '2.0',
          error: { code: -32700, message: `Parse error: ${err.message}` },
        };
        process.stdout.write(JSON.stringify(errorResponse) + '\n');
      }
    }
  });

  process.stdin.on('end', () => {
    process.exit(0);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    process.stderr.write(`[scorchcrawl-mcp] Fatal error: ${err.message}\n`);
    process.exit(1);
  });
}
