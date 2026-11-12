import type { ReactNode } from 'react';
import { circleParam, circleStaticParams } from '@/lib/circle-page';

export const generateStaticParams = circleStaticParams;

/** Unknown circle ids are a Vietnamese 404. The app frame's "Dây" tab covers every page of one circle. */
export default async function CircleLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  await circleParam(params);
  return <>{children}</>;
}
