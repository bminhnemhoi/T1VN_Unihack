import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['sdk', 'config'],
  // Monorepo root (silences the multiple-lockfile warning); `next` runs with cwd = apps/web.
  outputFileTracingRoot: path.resolve(process.cwd(), '../..'),
  poweredByHeader: false,
  // `simulate_circle` reads these generated files at runtime; tracing cannot see dynamic fs paths.
  outputFileTracingIncludes: { '/api/copilot': ['../../sim/outputs/*.json', '../../sim/scenarios/*.json'] },
  // The umbrella `radix-ui` package otherwise ships every primitive (menubar, accordion, ...) to the landing page.
  experimental: { optimizePackageImports: ['radix-ui', 'lucide-react'] },
  // Lint runs through `pnpm -r lint` (root flat config), not through `next build`.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
