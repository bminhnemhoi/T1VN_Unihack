import { CircleScreen } from '@/components/circle/CircleScreen';
import { circleParam, type CirclePageProps } from '@/lib/circle-page';

export const metadata = { title: 'Chi tiết dây' };

/** Overview of one circle: forming, bid room, fixed room or finished, from the sample or from the chain. Section pages live next to this file. */
export default async function Circle({ params }: CirclePageProps) {
  return <CircleScreen id={await circleParam(params)} screen="overview" />;
}
