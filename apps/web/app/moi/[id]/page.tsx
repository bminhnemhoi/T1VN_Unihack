import { notFound } from 'next/navigation';
import { InviteScreen } from '@/components/invite/InviteView';
import { isKnownCircleId } from '@/lib/circle-page';
import { circleStaticParams } from '@/lib/circle-page';

export const generateStaticParams = () => circleStaticParams().filter((p) => p.id === 'dang-gom');
export const metadata = { title: 'Lời mời vào dây' };

/** S05: what an invited person sees before joining. Sample mode has one invite page (`dang-gom`); with a deployment any circle address works. */
export default async function Invite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isKnownCircleId(id) || (id !== 'dang-gom' && !id.startsWith('0x'))) notFound();
  return <InviteScreen id={id} />;
}
