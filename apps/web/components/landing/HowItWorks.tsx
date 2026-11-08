import { ArtBu, ArtGop, ArtHot, ArtThamKin } from '@/components/landing/StepArt';

const STEPS = [
  { title: 'Góp', text: 'Mỗi kỳ chỉ trích đúng phần góp từ ví bạn, không sớm hơn.', Art: ArtGop },
  { title: 'Bỏ thăm kín', text: 'Thăm được niêm phong, đến giờ mới mở. Không ai biết thăm của ai.', Art: ArtThamKin },
  { title: 'Hốt', text: 'Người thăm cao nhất nhận tiền ngay trong cùng một giao dịch.', Art: ArtHot },
  { title: 'Bù nếu có người bỏ', text: 'Tiền giữ lại, rồi ký quỹ, rồi quỹ dự phòng bù trước. Người hốt sau vẫn nhận đủ.', Art: ArtBu },
];

/**
 * Four steps of one round as a connected process line (it is a real sequence, so the numbers carry information).
 * No card boxes: the line itself groups the steps, which keeps this section distinct from the trust bento below.
 * Phones: vertical line on the left. Desktop: horizontal line through the numbers.
 */
export function HowItWorks() {
  return (
    <section aria-labelledby="cach-chay" className="mx-auto max-w-6xl px-4 py-16">
      <h2 id="cach-chay" className="font-display text-h1 font-bold">
        Một kỳ hụi chạy thế nào
      </h2>
      <p className="mt-3 max-w-prose text-lead text-muted-foreground">Bốn bước, mỗi bước đều có số liệu để bạn tự kiểm lại.</p>
      <ol className="mt-10 grid gap-10 lg:grid-cols-4 lg:gap-8">
        {STEPS.map(({ title, text, Art }, i) => (
          <li key={title} className="relative grid grid-cols-[2.75rem_1fr] gap-x-5 lg:block">
            {i < STEPS.length - 1 && (
              <span
                aria-hidden
                className="absolute top-[2.75rem] left-[calc(1.375rem-1px)] h-[calc(100%-2.75rem+2.5rem)] w-0.5 bg-foreground/25 lg:top-[calc(1.375rem-1px)] lg:left-[2.75rem] lg:h-0.5 lg:w-[calc(100%-2.75rem+2rem)]"
              />
            )}
            <span className="font-display relative z-10 grid size-11 place-content-center rounded-full border-2 border-foreground bg-nghe text-2xl font-bold text-muc-dem">
              {i + 1}
            </span>
            <div className="lg:mt-5">
              <div className="max-w-80 lg:max-w-none">
                <Art />
              </div>
              <h3 className="mt-3 font-display text-h3 font-bold">{title}</h3>
              <p className="mt-1 max-w-prose text-muted-foreground">{text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
