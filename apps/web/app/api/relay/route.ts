/**
 * POST /api/relay (docs/05 8.2). Thin wrapper: all logic is in lib/server/relay.ts, all secrets in lib/server/env.ts.
 */
import { buildRelayHandler, lazyHandler } from '../../../lib/server/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = lazyHandler(() => buildRelayHandler(), 'relay');
