import { notFound } from 'next/navigation';
import type { ReactElement } from 'react';
import { isCircleId, type CircleId } from '@/lib/sample-circles';

/** Resolves the `[id]` segment of a circle section page, or renders the Vietnamese 404. */
export async function circleParam(params: Promise<{ id: string }>): Promise<CircleId> {
  const { id } = await params;
  if (!isCircleId(id)) notFound();
  return id;
}

export type CirclePageProps = { params: Promise<{ id: string }> };
export type CirclePage = (p: CirclePageProps) => Promise<ReactElement>;
