import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { once } from 'node:events';

function startMcpServer(handler) {
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
      reject(new Error('stream ended before newline'));
    };
    const cleanup = () => {
      stream.off('data', onData);
      stream.off('end', onEnd);
    };
    stream.on('data', onData);
    stream.on('end', onEnd);
  });
}

const cliPath = path.resolve(process.cwd(), 'dist/cli.js');
const sourceCliPath = path.resolve(process.cwd(), 'src/cli.ts');

async function runSmoke() {
  const { server, baseUrl } = await startMcpServer((req, res) => {
    if (req.url === '/mcp' && req.method === 'POST') {
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.end(
          'event: message\n' +
          'data: {"jsonrpc":"2.0","id":1,"result":{"success":true}}\n\n'
        );
      });
      return;
    }
    res.writeHead(404).end();
  });

  const cliCommand = process.execPath;
  const cliArgs = [];
  if (process.env.SCORCHCRAWL_SMOKE_USE_SOURCE === 'true') {
    cliArgs.push('--experimental-strip-types', sourceCliPath);
  } else {
    cliArgs.push(cliPath);
  }

  const child = spawn(cliCommand, cliArgs, {
    env: {
      ...process.env,
      SCORCHCRAWL_URL: baseUrl,
      SCORCHCRAWL_LOCAL_PROXY: 'false',
      SCORCHCRAWL_API_URL: baseUrl.replace(/24787$/, '24786'),
      SCORCHCRAWL_API_KEY: 'test',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const closePromise = once(child, 'close');

  try {
    child.stdin.write('{"jsonrpc":"2.0","id":1,"method":"ping"}\n');
    child.stdin.end();

    const stdoutLine = await waitForLine(child.stdout);
    const parsed = JSON.parse(stdoutLine);
    assert.equal(parsed.result.success, true);

    const [stderrChunk] = await once(child.stderr, 'data');
    assert.match(stderrChunk.toString('utf8'), /Connecting to/);
    assert.equal((await closePromise)[0], 0);
  } finally {
    child.kill('SIGTERM');
    server.close();
  }
}

runSmoke().catch((err) => {
  console.error(err);
  process.exit(1);
});
