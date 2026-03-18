import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'tests/mcp-protocol.test.ts',
      'tests/real-world.test.ts'
    ],
    testTimeout: 60_000,
    hookTimeout: 30_000,
  },
});
