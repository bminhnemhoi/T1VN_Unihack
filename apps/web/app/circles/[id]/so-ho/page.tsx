import { BookView } from '@/components/circle/BookView';
import { circleParam, type CirclePageProps } from '@/lib/circle-page';

export const metadata = { title: 'Sổ hụi (mẫu)' };

export default async function Page({ params }: CirclePageProps) {
  return <BookView id={await circleParam(params)} />;
}
