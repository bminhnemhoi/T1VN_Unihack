import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { CircleTabs } from '@/components/circle/CircleTabs';
import { CIRCLE_IDS, isCircleId } from '@/lib/sample-circles';

export const generateStaticParams = () => CIRCLE_IDS.map((id) => ({ id }));

/** Every page of one circle shares the section bar. Unknown ids are a Vietnamese 404. */
export default async function CircleLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isCircleId(id)) notFound();
  return (
    <>
      <CircleTabs id={id} />
      {children}
    </>
  );
}
