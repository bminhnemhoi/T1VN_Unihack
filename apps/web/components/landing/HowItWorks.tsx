import { ArtBu, ArtGop, ArtHot, ArtThamKin } from '@/components/landing/StepArt';

const STEPS = [
  { title: 'Góp', text: 'Mỗi kỳ chỉ trích đúng phần góp từ ví bạn, không sớm hơn.', Art: ArtGop },
  { title: 'Bỏ thăm kín', text: 'Thăm được niêm phong, đến giờ mới mở. Không ai biết thăm của ai.', Art: ArtThamKin },
  { title: 'Hốt', text: 'Người thăm cao nhất nhận tiền ngay trong cùng một giao dịch.', Art: ArtHot },
  { title: 'Bù nếu có người bỏ', text: 'Tiền giữ lại, rồi ký quỹ, rồi quỹ dự phòng bù trước. Người hốt sau vẫn nhận đủ.', Art: ArtBu },
];

/** Four steps in order, so numbering carries information here (it is a real sequence). */
export function HowItWorks() {
  return (
    <section aria-labelledby="cach-chay" className="mx-auto max-w-6xl px-4 py-16">
      <h2 id="cach-chay" className="font-display text-4xl font-bold md:text-5xl">
        Một kỳ hụi chạy thế nào
      </h2>
      <p className="mt-3 max-w-prose text-xl text-muted-foreground">Bốn bước, mỗi bước đều có số liệu để bạn tự kiểm lại.</p>
      <ol className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(({ title, text, Art }, i) => (
          <li key={title} className="to-giay the-nang relative p-5 pt-8">
            <span className="font-display absolute -top-5 left-5 grid size-11 place-content-center rounded-full border-2 border-foreground bg-nghe text-2xl font-bold text-muc-dem shadow-sm">
              {i + 1}
            </span>
            <Art />
            <h3 className="mt-3 font-display text-2xl font-bold">{title}</h3>
            <p className="mt-1 text-muted-foreground">{text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
