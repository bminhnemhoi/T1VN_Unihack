import { ShortfallView } from '@/components/circle/ShortfallView';
import { circleParam, type CirclePageProps } from '@/lib/circle-page';

export const metadata = { title: 'Khoản thiếu (mẫu)' };

export default async function Page({ params }: CirclePageProps) {
  return <ShortfallView id={await circleParam(params)} />;
}
