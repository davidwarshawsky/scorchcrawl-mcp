import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: [
      'tests/mcp-protocol.test.ts',
      'tests/real-world.test.ts'
    ],
    testTimeout: 10_000,
    hookTimeout: 10_000,
  },
});
