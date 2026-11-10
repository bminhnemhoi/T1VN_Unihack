/**
 * POST /api/relay/permit (docs/05 8.2b). Thin wrapper: all logic is in lib/server/relayPermit.ts, all secrets in lib/server/env.ts.
 */
import { buildRelayPermitHandler, lazyHandler } from '../../../../lib/server/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = lazyHandler(() => buildRelayPermitHandler(), 'relay-permit');
