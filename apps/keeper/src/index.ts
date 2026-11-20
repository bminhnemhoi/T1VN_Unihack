/**
 * Keeper entry point: `pnpm --filter keeper start`. Scans every `interval` seconds (15 s in demo mode, docs/05
 * section 9) and runs the idempotent actions in `keeper.ts`. Environment variable names are listed in `config.ts`.
 */
import { createViemPort } from './chain.js';
import { KeeperConfigError, loadKeeperConfig } from './config.js';
import { newKeeperMemory, tick, type Log } from './keeper.js';
import { formatLog } from './log.js';

const log: Log = (level, message, fields) => {
  const line = formatLog(level, message, new Date(), fields);
  if (level === 'error') console.error(line);
  else console.log(line);
};

async function main(): Promise<void> {
  const cfg = loadKeeperConfig();
  const { port, keeper } = createViemPort(cfg);
  log('info', 'keeper started', { network: cfg.network.name, keeper, intervalSeconds: cfg.intervalSeconds });

  const memory = newKeeperMemory(); // fair scan order and funded circles, kept across scans (issue #1)
  let running = false;
  const scan = async (): Promise<void> => {
    if (running) return; // never overlap two scans
    running = true;
    try {
      const s = await tick(port, log, memory);
      log('info', 'scan done', { ...s });
    } catch (e) {
      log('error', 'scan failed', { reason: e instanceof Error ? e.name : 'unknown' });
    } finally {
      running = false;
    }
  };

  await scan();
  const timer = setInterval(() => void scan(), cfg.intervalSeconds * 1000);
  const stop = (): void => {
    clearInterval(timer);
    log('info', 'keeper stopped');
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((e: unknown) => {
  const reason = e instanceof KeeperConfigError || e instanceof Error ? e.message : 'unknown';
  console.error(formatLog('error', 'keeper cannot start', new Date(), { reason }));
  process.exit(1);
});
