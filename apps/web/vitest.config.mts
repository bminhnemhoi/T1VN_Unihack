import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit tests live next to the code under lib/; Playwright specs in e2e/ are not picked up.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'app/**/*.test.ts'],
  },
});
