import { ResultView } from '@/components/circle/ResultView';
import { circleParam, type CirclePageProps } from '@/lib/circle-page';

export const metadata = { title: 'Kết quả kỳ (mẫu)' };

export default async function Page({ params }: CirclePageProps) {
  return <ResultView id={await circleParam(params)} />;
}
