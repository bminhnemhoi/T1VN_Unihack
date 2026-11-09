import { notFound } from 'next/navigation';
import { loadChainConfig } from '@/lib/chain/server';
import { isAddress } from '@/lib/live/circleData';
import { CIRCLE_IDS, isCircleId } from '@/lib/sample-circles';

/** Is `id` a circle of this deployment? Sample ids while nothing is deployed, circle addresses once something is. */
export function isKnownCircleId(id: string): boolean {
  return loadChainConfig() ? isAddress(id) : isCircleId(id);
}

/** `generateStaticParams` of the circle pages: the samples only (addresses render on demand). */
export const circleStaticParams = () => (loadChainConfig() ? [] : CIRCLE_IDS.map((id) => ({ id })));

/** Resolves the `[id]` segment of a circle page, or renders the Vietnamese 404. */
export async function circleParam(params: Promise<{ id: string }>): Promise<string> {
  const { id } = await params;
  if (!isKnownCircleId(id)) notFound();
  return id;
}

export type CirclePageProps = { params: Promise<{ id: string }> };
