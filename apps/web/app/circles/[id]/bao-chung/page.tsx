import { CoverageView } from '@/components/circle/CoverageView';
import { circleParam, type CirclePageProps } from '@/lib/circle-page';

export const metadata = { title: 'Bảo chứng (mẫu)' };

export default async function Page({ params }: CirclePageProps) {
  return <CoverageView id={await circleParam(params)} />;
}
