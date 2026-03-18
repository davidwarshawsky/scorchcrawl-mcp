import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const { forwardToServer } = await import('../../dist/cli.js');

function startServer(handler) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to bind test server'));
        return;
      }
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${address.port}`,
      });
    });
    server.on('error', reject);
  });
}

async function stopServer(server) {
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

test('forwards JSON-RPC to /mcp and propagates the copilot token', async () => {
  let seenHeaders;
  let seenBody;
  const { server, baseUrl } = await startServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    seenHeaders = req.headers;
    seenBody = Buffer.concat(chunks).toString('utf8');

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ jsonrpc: '2.0', id: 7, result: { ok: true } }));
  });

  try {
    const response = await forwardToServer(
      { jsonrpc: '2.0', id: 7, method: 'tools/list' },
      baseUrl,
      'ghu_test_token',
    );

    assert.equal(response.result.ok, true);
    assert.equal(seenHeaders['x-copilot-token'], 'ghu_test_token');
    assert.match(seenBody, /"method":"tools\/list"/);
  } finally {
    await stopServer(server);
  }
});

test('parses SSE responses returned by the MCP server', async () => {
  const { server, baseUrl } = await startServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.end('event: message\ndata: {"jsonrpc":"2.0","id":3,"result":{"pong":true}}\n\n');
  });

  try {
    const response = await forwardToServer(
      { jsonrpc: '2.0', id: 3, method: 'ping' },
      baseUrl,
    );

    assert.equal(response.result.pong, true);
  } finally {
    await stopServer(server);
  }
});

test('returns a structured error for unexpected bodies', async () => {
  const { server, baseUrl } = await startServer((req, res) => {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('upstream exploded');
  });

  try {
    const response = await forwardToServer(
      { jsonrpc: '2.0', id: 9, method: 'ping' },
      baseUrl,
    );

    assert.equal(response.error.code, -32603);
    assert.match(response.error.message, /Unexpected response/);
  } finally {
    await stopServer(server);
  }
});
