import { CircleRoom } from '@/components/app/CircleRoom';
import { circleParam, type CirclePageProps } from '@/lib/circle-page';

export const metadata = { title: 'Dây' };

/** "Dây": the circle as a timeline of rounds (forming and finished circles keep their own screens). */
export default async function Circle({ params }: CirclePageProps) {
  return <CircleRoom id={await circleParam(params)} />;
}
