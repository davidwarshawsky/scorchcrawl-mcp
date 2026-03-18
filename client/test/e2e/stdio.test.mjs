import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';

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

function waitForLine(stream) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const onData = (chunk) => {
      buffer += chunk.toString('utf8');
      const index = buffer.indexOf('\n');
      if (index !== -1) {
        cleanup();
        resolve(buffer.slice(0, index));
      }
    };
    const onEnd = () => {
      cleanup();
      reject(new Error('Stream ended before a newline-delimited message arrived'));
    };
    const cleanup = () => {
      stream.off('data', onData);
      stream.off('end', onEnd);
    };
    stream.on('data', onData);
    stream.on('end', onEnd);
  });
}

test('CLI forwards stdin JSON-RPC to the MCP server and writes stdout responses', async () => {
  const { server, baseUrl } = await startServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ jsonrpc: '2.0', id: 11, result: { ok: true } }));
  });

  const cliPath = path.resolve(process.cwd(), 'dist/cli.js');
  const child = spawn(process.execPath, [cliPath], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      SCORCHCRAWL_URL: baseUrl,
      GITHUB_TOKEN: 'ghu_child_token',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const closePromise = new Promise((resolve) => {
    child.on('close', (code) => resolve(code));
  });

  try {
    child.stdin.write('{"jsonrpc":"2.0","id":11,"method":"ping"}\n');
    child.stdin.end();

    const stdoutLine = await waitForLine(child.stdout);
    const stderrOutput = await new Promise((resolve) => {
      let stderr = '';
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString('utf8');
      });
      child.on('close', () => resolve(stderr));
    });

    const parsed = JSON.parse(stdoutLine);
    assert.equal(parsed.result.ok, true);
    assert.match(stderrOutput, /Connecting to/);
    assert.equal(await closePromise, 0);
  } finally {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
    await stopServer(server);
  }
});

test('CLI returns parse errors on malformed stdin payloads', async () => {
  const cliPath = path.resolve(process.cwd(), 'dist/cli.js');
  const child = spawn(process.execPath, [cliPath], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      SCORCHCRAWL_URL: 'http://127.0.0.1:65535',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const closePromise = new Promise((resolve) => {
    child.on('close', (code) => resolve(code));
  });

  try {
    child.stdin.write('not-json\n');
    child.stdin.end();

    const stdoutLine = await waitForLine(child.stdout);
    const parsed = JSON.parse(stdoutLine);
    assert.equal(parsed.error.code, -32700);
    assert.match(parsed.error.message, /Parse error/);
    assert.equal(await closePromise, 0);
  } finally {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }
});
