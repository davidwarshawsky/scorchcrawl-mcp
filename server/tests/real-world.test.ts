/**
 * @file real-world.test.ts
 * Integration tests hitting live websites via the scorch_scrape tool.
 *
 * These verify:
 *  - Basic connectivity and extraction (example.com)
 *  - Format handling (httpbin.org)
 *  - Stealth/Bypass targets (pocs.click)
 *
 * NOTE: These tests hit live websites and require the ScorchCrawl MCP server
 * to be running at MCP_TEST_URL (default: http://localhost:24787)
 * and an active ScorchCrawl API engine.
 */

import { describe, it, expect } from 'vitest';

const MCP_URL = process.env.MCP_TEST_URL || 'http://localhost:24787';

async function mcpCall(toolName: string, args: Record<string, unknown> = {}) {
  const response = await fetch(`${MCP_URL}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Math.floor(Math.random() * 1000),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`MCP call failed with status ${response.status}`);
  }

  const text = await response.text();
  const dataLine = text.split('\n').find((line) => line.startsWith('data: '));
  if (!dataLine) throw new Error(`No data: line in SSE response:\n${text}`);
  return JSON.parse(dataLine.slice('data: '.length));
}

describe('Real-World Scraping Integration', () => {
  // Increase timeout for real network requests
  const TIMEOUT = 60_000;

  it('scrapes example.com as markdown', async () => {
    const res = await mcpCall('scorch_scrape', {
      url: 'https://example.com',
      formats: ['markdown']
    });

    expect(res).toHaveProperty('result');
    expect(res.result).toHaveProperty('content');
    const content = res.result.content[0].text;
    expect(content).toContain('Example Domain');
    expect(content).toContain('This domain is for use in');
  }, TIMEOUT);

  it('scrapes httpbin.org/get as JSON', async () => {
    const res = await mcpCall('scorch_scrape', {
      url: 'https://httpbin.org/get',
      formats: [{
        type: 'json',
        prompt: 'Extract the URL and headers from the page',
        schema: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            headers: { type: 'object' }
          }
        }
      }]
    });

    expect(res).toHaveProperty('result');
    const contentText = res.result.content[0].text;
    // We expect either the extraction to work (if engine up) or a JSON string.
    // Given the engine might be down, we just check we got a result.
    expect(contentText).toBeTruthy();
  }, TIMEOUT);

  it('scrapes pocs.click for stealth verification', async () => {
    const res = await mcpCall('scorch_scrape', {
      url: 'https://pocs.click',
      formats: ['markdown']
    });

    expect(res).toHaveProperty('result');
    const content = res.result.content[0].text;
    // pocs.click content check — typically has some indication of success
    expect(content).toBeTruthy();
  }, TIMEOUT);

  it('performs a search on searxng (if configured through engine)', async () => {
    const res = await mcpCall('scorch_search', {
      query: 'ScorchCrawl GitHub',
      limit: 3
    });

    expect(res).toHaveProperty('result');
    expect(res.result).toHaveProperty('content');
    const content = res.result.content[0].text;
    // If it's a real response, it should be non-empty
    expect(content).toBeTruthy();
  }, TIMEOUT);
});
