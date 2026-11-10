import { Check } from 'lucide-react';
import { HeroMeter } from '@/components/landing/HeroMeter';
import { Seal } from '@/components/brand/Seal';
import { HeroActions } from '@/components/landing/HeroActions';

const FACTS = ['Không ai cầm tiền', 'Chủ hụi khóa ký quỹ', 'Sổ hụi công khai'];

/** S01 hero: dark ink band, one big sentence, one toy (the meter). Staggered entrance via --i. */
export function Hero() {
  return (
    <section className="nen-muc overflow-hidden">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 md:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 [&>*]:min-w-0">
        <div className="vien-le-do">
          <h1 className="vao font-display text-display font-bold tracking-tight" style={{ ['--i' as string]: 0 }}>
            Chơi hụi không sợ giựt.
          </h1>
          <p className="vao mt-6 max-w-prose font-display text-[1.6rem] leading-snug text-[#dfe5f0]" style={{ ['--i' as string]: 1 }}>
            Tiền ở trong ví bạn cho đến hạn góp. Chủ hụi không cầm tiền, nhưng vẫn phải bảo lãnh.
          </p>
          <ul className="vao mt-6 flex flex-wrap gap-2" style={{ ['--i' as string]: 2 }}>
            {FACTS.map((f) => (
              <li key={f} className="rounded-full border border-[#c9d2e0]/40 px-4 py-1.5 font-semibold">
                <Check aria-hidden className="mr-1 inline size-4 align-[-2px]" /> {f}
              </li>
            ))}
          </ul>
          <HeroActions />
        </div>
        <div className="vao relative" style={{ ['--i' as string]: 2 }}>
          <Seal size={92} className="absolute -top-10 -left-6 z-10 hidden -rotate-12 md:block text-le-do-sang opacity-90" />
          <HeroMeter />
        </div>
      </div>
    </section>
  );
}
