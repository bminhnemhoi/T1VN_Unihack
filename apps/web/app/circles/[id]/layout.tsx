import type { ReactNode } from 'react';
import { CircleTabs } from '@/components/circle/CircleTabs';
import { circleParam, circleStaticParams } from '@/lib/circle-page';

export const generateStaticParams = circleStaticParams;

/** Every page of one circle shares the section bar. Unknown ids are a Vietnamese 404. */
export default async function CircleLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const id = await circleParam(params);
  return (
    <>
      <CircleTabs id={id} />
      {children}
    </>
  );
}
