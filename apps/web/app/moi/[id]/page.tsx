import { notFound } from 'next/navigation';
import { InviteView } from '@/components/invite/InviteView';

const IDS = ['dang-gom'] as const;
export const generateStaticParams = () => IDS.map((id) => ({ id }));
export const metadata = { title: 'Lời mời vào dây (mẫu)' };

/** S05: what an invited person sees before joining. Only the sample forming circle has an invite page. */
export default async function Invite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id !== 'dang-gom') notFound();
  return <InviteView />;
}
