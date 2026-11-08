import { Plus } from 'lucide-react';

const QA = [
  ['Chủ hụi có cầm tiền của tôi không?', 'Không. Tiền ở trong ví bạn. Đến hạn, chỉ phần góp của kỳ đó được trích và trả cho người hốt ngay trong cùng một giao dịch. Chủ hụi chỉ khóa ký quỹ để bảo lãnh.'],
  ['Nếu có người bỏ đóng thì sao?', 'Khoản thiếu được bù theo thứ tự: tiền giữ lại của chính người đó, rồi ký quỹ của chủ hụi, rồi quỹ dự phòng. Người hốt không bị thiệt khi bảo chứng đạt 100%.'],
  ['Bỏ thăm kín là gì?', 'Bạn nộp thăm dưới dạng niêm phong. Đến giờ mở thăm, thăm mới được lộ ra, nên không ai biết thăm của người khác trước. Thăm cao nhất hốt, bằng nhau thì xét theo luật cố định, không có may rủi.'],
  ['Tôi có cần ví hay phí mạng không?', 'Không. Bạn đăng nhập bằng Google hoặc email. HụiSafe trả phí giao dịch thay bạn.'],
  ['Có đúng luật không?', 'HụiSafe tính trần lãi, lãi chậm góp và nhắc thông báo UBND theo Nghị định 19/2019/NĐ-CP. Đây là cách hiểu của chúng tôi, chưa phải ý kiến pháp lý.'],
  ['Đây là tiền thật không?', 'Chưa. Bản này chạy trên Avalanche Fuji, mạng thử, dùng USDC thử nghiệm không có giá trị.'],
];

export function Faq() {
  return (
    <section aria-labelledby="hoi-dap" className="mx-auto grid max-w-6xl gap-8 px-4 py-16 lg:grid-cols-[1fr_2fr] lg:gap-16">
      <div>
        <h2 id="hoi-dap" className="font-display text-h1 font-bold">
          Hay hỏi
        </h2>
        <p className="mt-3 max-w-prose text-xl text-muted-foreground">Những điều nên biết trước khi vào dây.</p>
      </div>
      <div>
        {QA.map(([q, a]) => (
          <details key={q} className="hoi dong-ke">
            <summary className="flex min-h-14 items-center justify-between gap-4 py-3 text-xl font-semibold">
              {q}
              <Plus aria-hidden className="dau-cong size-6 shrink-0 text-primary transition-transform duration-200" />
            </summary>
            <p className="max-w-prose pb-5 text-muted-foreground">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
