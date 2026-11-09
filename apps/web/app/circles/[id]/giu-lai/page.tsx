import { HoldbackView } from '@/components/circle/HoldbackView';
import { circleParam, type CirclePageProps } from '@/lib/circle-page';

export const metadata = { title: 'Tiền giữ lại (mẫu)' };

export default async function Page({ params }: CirclePageProps) {
  return <HoldbackView id={await circleParam(params)} />;
}
