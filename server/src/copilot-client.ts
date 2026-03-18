import { CopilotClient } from '@github/copilot-sdk';

const clientCache = new Map<string, { client: CopilotClient; lastUsed: number }>();
const MAX_CLIENT_AGE_MS = 30 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of clientCache) {
    if (now - entry.lastUsed > MAX_CLIENT_AGE_MS) {
      try {
        entry.client.stop();
      } catch {
        // Ignore shutdown failures for stale cached clients.
      }
      clientCache.delete(key);
    }
  }
}, 5 * 60 * 1000);

export async function getCopilotClient(userToken?: string): Promise<CopilotClient> {
  const cacheKey = userToken || '';
  const existing = clientCache.get(cacheKey);
  if (existing) {
    existing.lastUsed = Date.now();
    return existing.client;
  }

  const clientOpts: Record<string, unknown> = {};

  if (process.env.COPILOT_CLI_PATH) {
    clientOpts.cliPath = process.env.COPILOT_CLI_PATH;
  }
  if (process.env.COPILOT_CLI_URL) {
    clientOpts.cliUrl = process.env.COPILOT_CLI_URL;
  }

  const token = userToken || process.env.GITHUB_TOKEN;
  if (token) {
    clientOpts.githubToken = token;
  }

  const client = new CopilotClient(clientOpts as any);
  clientCache.set(cacheKey, { client, lastUsed: Date.now() });
  return client;
}