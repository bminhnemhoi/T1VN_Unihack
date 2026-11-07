import { EventTicker } from '@/components/landing/EventTicker';
import { Faq } from '@/components/landing/Faq';
import { FinalCta } from '@/components/landing/FinalCta';
import { Hero } from '@/components/landing/Hero';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { StatsBand } from '@/components/landing/StatsBand';
import { TrustGrid } from '@/components/landing/TrustGrid';

/** S01: landing. Art direction in .handover/DESIGN-BRIEF.md (direction A, "Sổ hụi, bản in sang"). */
export default function Home() {
  return (
    <main id="noi-dung">
      <Hero />
      <EventTicker />
      <HowItWorks />
      <TrustGrid />
      <StatsBand />
      <Faq />
      <FinalCta />
    </main>
  );
}
