# ScorchCrawl Testing Conventions

This document outlines the testing strategy and conventions for the ScorchCrawl project.

## Overview

We use a multi-layered testing approach:
1.  **Unit Tests**: Verify individual functions and classes in isolation. Located in `server/tests/*.test.ts` and `client/test/unit/*.test.mjs`.
2.  **Integration Tests**: Verify the interaction between components and protocol compliance. Located in `server/tests/mcp-protocol.test.ts` and `client/test/integration/*.test.mjs`.
3.  **E2E Tests**: Verify the full system flow from client to server. Located in `client/test/e2e/*.test.mjs`.
4.  **Real-World Scraping Tests**: Verify the ability to scrape content from live websites.

## Running Tests

### Server Tests
```bash
cd scorchcrawl-mcp/server
npm run test             # Run unit tests
npm run test:integration # Run protocol integration tests (requires server running)
```

### Client Tests
```bash
cd scorchcrawl-mcp/client
npm run test:unit        # Run unit tests
npm run test:integration # Run integration tests
npm run test:e2e         # Run E2E tests
```

## Conventions

- **Naming**: Test files should end in `.test.ts` (TypeScript) or `.test.mjs` (ES Modules).
- **Framework**: We use [Vitest](https://vitest.dev/) for the server and Node's built-in `--test` runner for the client.
- **Mocking**: Use `vi.mock()` in Vitest to isolate components for unit tests.
- **Timeouts**: Integration and E2E tests may require longer timeouts (30-60s) due to network activity.
- **Environment**: Use `.env.test` or environment variables to configure test targets.

## Real-World Scraping Tests

These tests hit live websites to ensure the stealth and extraction logic works as expected.

Target websites should include:
- `example.com` (Static, simple)
- `httpbin.org` (API testing)
- `pocs.click` (Stealth testing target)
- `github.com` (Complex, potential bot detection)

To run real scraping tests:
```bash
cd scorchcrawl-mcp/server
node tests/test-real-scrape.mjs
# or use the Vitest suite (if configured)
```
