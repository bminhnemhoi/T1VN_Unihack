import { SettleView } from '@/components/circle/SettleView';
import { circleParam, type CirclePageProps } from '@/lib/circle-page';

export const metadata = { title: 'Tất toán (mẫu)' };

export default async function Page({ params }: CirclePageProps) {
  return <SettleView id={await circleParam(params)} />;
}
