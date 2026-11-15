import { Landing } from '@/components/landing/Landing';
import { loadChainConfig } from '@/lib/chain/server';

/** S01: landing. Art direction (Awwwards references, 12/11/2026) is described at the top of components/landing/landing.module.css. */
export default function Home() {
  // `null` = nothing deployed on this network: the landing says the app runs on sample data (same rule as the layout).
  const chain = loadChainConfig();
  return <Landing sample={chain === null} factory={chain?.factory} />;
}
