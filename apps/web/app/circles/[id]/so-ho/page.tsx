import { FullBook, Ledger } from '@/components/app/Ledger';
import { circleParam, type CirclePageProps } from '@/lib/circle-page';

export const metadata = { title: 'Sổ hụi' };
/** Reads `?ban=`, so it cannot be prerendered: a circle outside `generateStaticParams` would fail with DYNAMIC_SERVER_USAGE. */
export const dynamic = 'force-dynamic';

/** "Sổ hụi": round x member ledger; `?ban=day-du` opens the full printable book (NĐ 19 Điều 12, 13). */
export default async function Page({ params, searchParams }: CirclePageProps & { searchParams: Promise<{ ban?: string }> }) {
  const id = await circleParam(params);
  const { ban } = await searchParams;
  return ban === 'day-du' ? <FullBook id={id} /> : <Ledger id={id} />;
}
