import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['sdk', 'config'],
  // Monorepo root (silences the multiple-lockfile warning); `next` runs with cwd = apps/web.
  outputFileTracingRoot: path.resolve(process.cwd(), '../..'),
  // Lint runs through `pnpm -r lint` (root flat config), not through `next build`.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
