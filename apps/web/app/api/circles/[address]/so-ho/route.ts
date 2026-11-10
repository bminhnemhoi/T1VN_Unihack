/**
 * GET /api/circles/[address]/so-ho?format=json (docs/05 8.3). Thin wrapper; logic in lib/server/bookRoute.ts.
 */
import { buildBookHandler } from '../../../../../lib/server/bookHandler';
import { lazyHandler } from '../../../../../lib/server/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = lazyHandler(() => buildBookHandler(), 'so-ho');
