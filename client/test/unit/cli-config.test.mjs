import test from 'node:test';
import assert from 'node:assert/strict';

const { resolveServerConfig, isLocalProxyEnabled } = await import('../../dist/cli.js');

test('uses the explicit MCP URL when provided', () => {
  const config = resolveServerConfig({
    SCORCHCRAWL_URL: 'http://localhost:24787/',
  });

  assert.equal(config.serverBaseUrl, 'http://localhost:24787');
  assert.equal(config.source, 'SCORCHCRAWL_URL');
  assert.deepEqual(config.warnings, []);
});

test('accepts SCORCHCRAWL_API_URL when it already targets the MCP endpoint', () => {
  const config = resolveServerConfig({
    SCORCHCRAWL_API_URL: 'https://example.com/mcp',
  });

  assert.equal(config.serverBaseUrl, 'https://example.com');
  assert.equal(config.source, 'SCORCHCRAWL_API_URL');
  assert.equal(config.warnings.length, 1);
});

test('derives the local MCP endpoint from the local engine endpoint', () => {
  const config = resolveServerConfig({
    SCORCHCRAWL_API_URL: 'http://localhost:24786',
  });

  assert.equal(config.serverBaseUrl, 'http://localhost:24787');
  assert.equal(config.source, 'SCORCHCRAWL_API_URL');
  assert.match(config.warnings[0], /needs the MCP server/);
});

test('rejects remote engine URLs passed as SCORCHCRAWL_API_URL', () => {
  assert.throws(
    () => resolveServerConfig({ SCORCHCRAWL_API_URL: 'https://pocs.click/scorchcrawl-api' }),
    /Set SCORCHCRAWL_URL to the MCP endpoint/
  );
});

test('local proxy flag only accepts the explicit true value', () => {
  assert.equal(isLocalProxyEnabled({ SCORCHCRAWL_LOCAL_PROXY: 'true' }), true);
  assert.equal(isLocalProxyEnabled({ SCORCHCRAWL_LOCAL_PROXY: '1' }), false);
  assert.equal(isLocalProxyEnabled({}), false);
});
