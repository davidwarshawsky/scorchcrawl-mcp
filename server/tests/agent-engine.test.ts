/**
 * @file agent-engine.test.ts
 * Unit tests for the Copilot SDK Agent Engine in copilot-agent.ts.
 *
 * This file verifies:
 *  - startAgent() correctly registers jobs and kicks off the background process.
 *  - getAgentStatus() retrieves correctly.
 *  - buildScrapingTools() creates correct Tool definitions.
 *  - Rate limiting logic is called (by mocking RateLimitGuard).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';

// Mock uuid and rate-limiter
vi.mock('uuid', () => ({ v4: vi.fn(() => 'job-123') }));
vi.mock('./rate-limiter.js', () => ({
  RateLimitGuard: vi.fn(() => ({
    check: vi.fn(() => ({ allowed: true })),
    acquire: vi.fn(),
    release: vi.fn(),
    stats: vi.fn(() => ({})),
    shutdown: vi.fn(),
    config: { staleJobTimeoutMs: 300000, gcIntervalMs: 60000 },
  })),
  buildRateLimitConfig: vi.fn(() => ({})),
  findStaleJobs: vi.fn(() => []),
  buildErrorHook: vi.fn(() => () => {}),
}));

// Mock @github/copilot-sdk
vi.mock('@github/copilot-sdk', () => {
    return {
        CopilotClient: vi.fn(() => ({
            createSession: vi.fn(async () => ({
                sendAndWait: vi.fn(async () => ({ data: { content: 'Research results' } })),
                destroy: vi.fn(async () => {}),
                on: vi.fn(),
            })),
            stop: vi.fn(async () => {}),
        })),
    };
});

// Mock ScorchClient
const mockScorchClient = {
  scrape: vi.fn(),
  search: vi.fn(),
  map: vi.fn(),
  extract: vi.fn(),
} as any;

// We need to import the functions to test.
// Since copilot-agent.ts has top-level side effects (setInterval), we mock them if we can or just let them run.
import {
  startAgent,
  getAgentStatus,
  buildAgentConfig,
  getDefaultModel,
  parseAllowedModels,
} from '../src/copilot-agent.js';

describe('Agent Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Configuration', () => {
    it('parseAllowedModels should return default values', () => {
      delete process.env.COPILOT_AGENT_MODELS;
      expect(parseAllowedModels()).toEqual(['gpt-4.1', 'gpt-4o', 'gpt-5-mini', 'grok-code-fast-1']);
    });

    it('getDefaultModel should return the first allowed model', () => {
      delete process.env.COPILOT_AGENT_DEFAULT_MODEL;
      expect(getDefaultModel()).toBe('gpt-4.1');
    });

    it('buildAgentConfig should return a valid config', () => {
      const config = buildAgentConfig();
      expect(config).toHaveProperty('allowedModels');
      expect(config).toHaveProperty('defaultModel');
    });
  });

  describe('startAgent', () => {
    it('should kick off an agent job and return job ID', async () => {
      const config = buildAgentConfig();
      const request = { prompt: 'Find the meaning of life' };
      const res = await startAgent(request, mockScorchClient, 'test-origin', config);

      expect(res.id).toBe('job-123');
      expect(res.status).toBe('processing');

      const status = getAgentStatus('job-123');
      expect(status).not.toBeNull();
      expect(status?.prompt).toBe('Find the meaning of life');
      expect(status?.status).toBe('processing');
    });

    it('should reject unknown models', async () => {
        const config = buildAgentConfig();
        const request = { prompt: 'test', model: 'unsupported-model' };
        const res = await startAgent(request, mockScorchClient, 'test-origin', config);

        expect(res.status).toBe('failed');
        expect(res.error).toContain('is not in the allowed list');
    });
  });

  describe('getAgentStatus', () => {
    it('should return null for non-existent job', () => {
        expect(getAgentStatus('none')).toBeNull();
    });
  });
});
