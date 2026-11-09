import { DoneView } from '@/components/circle/DoneView';
import { FixedRoomView } from '@/components/circle/FixedRoomView';
import { FormingView } from '@/components/circle/FormingView';
import { RoomView } from '@/components/circle/RoomView';
import { circleParam, type CirclePageProps } from '@/lib/circle-page';

export const metadata = { title: 'Chi tiết dây (mẫu)' };

/** Overview of one sample circle (S04 forming, S06 bid room, Fixed room, finished). Section pages live in the folders next to this file. */
export default async function SampleCircle({ params }: CirclePageProps) {
  const id = await circleParam(params);
  if (id === 'demo') return <RoomView />;
  if (id === 'co-dinh') return <FixedRoomView id={id} />;
  if (id === 'dang-gom') return <FormingView id={id} />;
  return <DoneView id={id} />;
}
