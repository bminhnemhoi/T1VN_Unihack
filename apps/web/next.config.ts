import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The chain-mode check builds into its own folder (`playwright.chain.config.ts`) so it cannot overwrite the sample build.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  transpilePackages: ['sdk', 'config'],
  // Monorepo root (silences the multiple-lockfile warning); `next` runs with cwd = apps/web.
  outputFileTracingRoot: path.resolve(process.cwd(), '../..'),
  poweredByHeader: false,
  // The Docker image builds a self-contained server (`.next/standalone`, only the traced node_modules). Off by default so
  // `next start` (Playwright, VPS without Docker) keeps working untouched; the Dockerfile sets NEXT_OUTPUT=standalone.
  ...(process.env.NEXT_OUTPUT === 'standalone' ? { output: 'standalone' as const } : {}),
  // `simulate_circle` reads these generated files at runtime; tracing cannot see dynamic fs paths.
  outputFileTracingIncludes: { '/api/copilot': ['../../sim/outputs/*.json', '../../sim/scenarios/*.json'] },
  // The umbrella `radix-ui` package otherwise ships every primitive (menubar, accordion, ...) to the landing page.
  experimental: { optimizePackageImports: ['radix-ui', 'lucide-react'] },
  // Lint runs through `pnpm -r lint` (root flat config), not through `next build`.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
