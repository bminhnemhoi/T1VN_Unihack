/**
 * Keeper entry point: `pnpm --filter keeper start`. Scans every `interval` seconds (15 s in demo mode, docs/05
 * section 9) and runs the idempotent actions in `keeper.ts`. Environment variable names are listed in `config.ts`.
 */
import { createViemPort } from './chain.js';
import { KeeperConfigError, loadKeeperConfig } from './config.js';
import { tick, type Log } from './keeper.js';
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

  let running = false;
  let wakeTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleWake = (sec: number | undefined): void => {
    if (wakeTimer) {
      clearTimeout(wakeTimer);
      wakeTimer = undefined;
    }
    if (sec !== undefined && sec > 0 && sec < cfg.intervalSeconds) {
      wakeTimer = setTimeout(() => void scan(), sec * 1000);
    }
  };
  const scan = async (): Promise<void> => {
    if (running) return; // never overlap two scans
    running = true;
    try {
      const s = await tick(port, log);
      log('info', 'scan done', {
        circles: s.circles,
        ignored: s.ignored,
        sent: s.sent,
        skipped: s.skipped,
        failed: s.failed,
        ...(s.nextDueInSec !== undefined ? { nextDueInSec: s.nextDueInSec } : {}),
      });
      scheduleWake(s.nextDueInSec);
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
    if (wakeTimer) clearTimeout(wakeTimer);
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
