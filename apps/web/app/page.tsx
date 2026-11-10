import { Faq } from '@/components/landing/Faq';
import { FinalCta } from '@/components/landing/FinalCta';
import { Hero } from '@/components/landing/Hero';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { TrustGrid } from '@/components/landing/TrustGrid';
import { loadChainConfig } from '@/lib/chain/server';

/** S01: landing. Art direction in .handover/DESIGN-BRIEF.md (direction A, "Sổ hụi, bản in sang"). */
export default function Home() {
  return (
    <main id="noi-dung">
      <Hero />
      <HowItWorks />
      <TrustGrid />
      <Faq />
      <FinalCta sample={loadChainConfig() === null} />
    </main>
  );
}
