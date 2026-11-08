/**
 * Locates `contracts/deployments` without `new URL(..., import.meta.url)`, which bundlers try to resolve statically
 * (a missing `fuji.json` before the first deploy would break `next build`). Walks up from the working directory
 * (apps/web, apps/keeper, packages/*, repo root all work); `HUISAFE_DEPLOYMENTS_DIR` overrides it.
 */
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export function deploymentsDir(
  start: string = process.cwd(),
  env: Record<string, string | undefined> = process.env,
): string {
  if (env.HUISAFE_DEPLOYMENTS_DIR) return resolve(env.HUISAFE_DEPLOYMENTS_DIR);
  let dir = resolve(start);
  for (;;) {
    const candidate = join(dir, 'contracts', 'deployments');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return join(resolve(start), 'contracts', 'deployments');
    dir = parent;
  }
}
