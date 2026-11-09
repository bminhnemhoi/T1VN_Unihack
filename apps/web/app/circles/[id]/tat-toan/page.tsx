import { CircleScreen } from '@/components/circle/CircleScreen';
import { circleParam, type CirclePageProps } from '@/lib/circle-page';

export const metadata = { title: 'Tất toán (mẫu)' };

export default async function Page({ params }: CirclePageProps) {
  return <CircleScreen id={await circleParam(params)} screen="tat-toan" />;
}
