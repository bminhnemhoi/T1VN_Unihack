import { notFound } from 'next/navigation';
import { SampleCircleView } from '@/components/circle/SampleCircleView';
import { RoomView } from '@/components/circle/RoomView';

/** Sample circle pages (S04 + S06 mock). The three known ids are prerendered; any other id is a Vietnamese 404. */
const IDS = ['demo', 'dang-gom', 'da-xong'] as const;
export const generateStaticParams = () => IDS.map((id) => ({ id }));
export const metadata = { title: 'Chi tiết dây (mẫu)' };

export default async function SampleCircle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id === 'demo') return <RoomView />;
  if (id === 'dang-gom' || id === 'da-xong') return <SampleCircleView kind={id} />;
  notFound();
}
