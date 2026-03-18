/**
 * @file local-scraper.test.ts
 * Unit tests for the local scraper module.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { localScrape, isLocalProxyEnabled, getCleanApiUrl } from '../src/local-scraper.js';

describe('Local Scraper', () => {
  describe('isLocalProxyEnabled', () => {
    const originalProxy = process.env.SCORCHCRAWL_LOCAL_PROXY;
    const originalUrl = process.env.SCORCHCRAWL_API_URL;

    afterEach(() => {
      process.env.SCORCHCRAWL_LOCAL_PROXY = originalProxy;
      process.env.SCORCHCRAWL_API_URL = originalUrl;
    });

    it('returns true if SCORCHCRAWL_LOCAL_PROXY is true', () => {
      process.env.SCORCHCRAWL_LOCAL_PROXY = 'true';
      expect(isLocalProxyEnabled()).toBe(true);
    });

    it('returns true if SCORCHCRAWL_API_URL has localProxy=true', () => {
      delete process.env.SCORCHCRAWL_LOCAL_PROXY;
      process.env.SCORCHCRAWL_API_URL = 'http://api.example.com?localProxy=true';
      expect(isLocalProxyEnabled()).toBe(true);
    });

    it('returns false by default', () => {
      delete process.env.SCORCHCRAWL_LOCAL_PROXY;
      delete process.env.SCORCHCRAWL_API_URL;
      expect(isLocalProxyEnabled()).toBe(false);
    });
  });

  describe('getCleanApiUrl', () => {
    it('removes localProxy param', () => {
      process.env.SCORCHCRAWL_API_URL = 'http://api.example.com?foo=bar&localProxy=true';
      expect(getCleanApiUrl()).toBe('http://api.example.com/?foo=bar');
    });

    it('returns undefined if env is missing', () => {
      delete process.env.SCORCHCRAWL_API_URL;
      expect(getCleanApiUrl()).toBeUndefined();
    });
  });

  describe('localScrape', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn(async () => ({
            status: 200,
            headers: new Map([['content-type', 'text/html']]),
            url: 'https://example.com',
            text: async () => '<html><body><h1>Hello World</h1><p>' + 'A real paragraph with enough content to satisfy the scraper logic. '.repeat(10) + '</p></body></html>',
        })));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('fetches and converts to markdown', async () => {
        const result = await localScrape('https://example.com');
        expect(result.success).toBe(true);
        expect(result.data?.markdown).toContain('# Hello World');
        expect(result.data?.markdown).toContain('real paragraph');
    });

    it('respects onlyMainContent', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({
            status: 200,
            headers: new Map(),
            text: async () => '<html><body><nav>Menu</nav><main><h1>Main</h1></main></body></html>',
        })));
        const result = await localScrape('https://example.com', { onlyMainContent: true });
        expect(result.data?.markdown).not.toContain('Menu');
        expect(result.data?.markdown).toContain('# Main');
    });

    it('returns error on timeout', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            throw err;
        }));
        const result = await localScrape('https://example.com', { timeout: 10 });
        expect(result.success).toBe(false);
        expect(result.error).toContain('Timeout');
    });

    it('rejects formats that need server-side processing', async () => {
        const result = await localScrape('https://example.com', { formats: ['json'] });
        expect(result.success).toBe(false);
        expect(result.error).toBe('FORMAT_NEEDS_SERVER');
    });
  });
});
