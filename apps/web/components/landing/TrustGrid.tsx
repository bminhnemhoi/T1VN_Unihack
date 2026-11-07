import { Check, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

function Ticks({ items, dark }: { items: string[]; dark?: boolean }) {
  return (
    <ul className="mt-4 space-y-2">
      {items.map((t) => (
        <li key={t} className="flex gap-2.5">
          <Check aria-hidden className={cn('mt-1 size-5 shrink-0 rounded-full p-0.5', dark ? 'bg-nghe text-muc-dem' : 'bg-ngoc text-white')} strokeWidth={3} />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function Cell({ className, children, dark }: { className?: string; children: ReactNode; dark?: boolean }) {
  return (
    <div className={cn('the-nang p-6', dark ? 'nen-muc rounded-xl to-giay-nang' : 'to-giay', className)}>{children}</div>
  );
}

/** Bento of the four trust claims. Cells differ in size and weight on purpose: "không ai cầm tiền" is the lead. */
export function TrustGrid() {
  return (
    <section aria-labelledby="tin-cay" className="mx-auto max-w-6xl px-4 py-8">
      <h2 id="tin-cay" className="font-display text-4xl font-bold md:text-5xl">
        Vì sao tin được
      </h2>
      <div className="mt-8 grid gap-5 md:grid-cols-6">
        <Cell dark className="md:col-span-4">
          <h3 className="font-display text-3xl font-bold">Không ai cầm tiền</h3>
          <p className="mt-2 max-w-prose text-xl text-[#dfe5f0]">
            Tiền nằm trong ví từng người cho đến hạn. Đến kỳ, hệ thống kéo đúng phần góp và trả cho người hốt trong cùng một giao dịch.
          </p>
          <div aria-hidden className="mt-6 flex items-center gap-3 font-semibold">
            <span className="rounded-full border border-[#c9d2e0]/50 px-4 py-2">Ví của bạn</span>
            <span className="h-0.5 flex-1 border-t-2 border-dashed border-nghe" />
            <span className="rounded-full bg-nghe px-4 py-2 text-muc-dem">Người hốt</span>
          </div>
          <p className="mt-3 font-hand text-2xl text-nghe">chủ hụi không nằm giữa đường này</p>
        </Cell>
        <Cell className="md:col-span-2">
          <ShieldCheck aria-hidden className="size-9 text-ngoc" />
          <h3 className="mt-2 font-display text-2xl font-bold">Theo Nghị định 19/2019</h3>
          <Ticks items={['Trần lãi 20%/năm (Điều 21)', 'Lãi chậm góp 10%/năm (Điều 22)', 'Nhắc thông báo UBND (Điều 14)']} />
        </Cell>
        <Cell className="md:col-span-2">
          <h3 className="font-display text-2xl font-bold">Chủ hụi khóa ký quỹ</h3>
          <p className="mt-1 text-muted-foreground">Dây mẫu: khóa 480 trên 600 USDC rủi ro lớn nhất.</p>
          <div aria-hidden className="mt-4 h-4 rounded-full bg-secondary shadow-[inset_0_0_0_1px_var(--input)]">
            <div className="h-full w-4/5 rounded-full bg-ngoc" />
          </div>
          <p className="so-ke mt-2 font-semibold">480 USDC ký quỹ + 20% giữ lại = 100%</p>
        </Cell>
        <Cell className="md:col-span-2">
          <h3 className="font-display text-2xl font-bold">Sổ hụi công khai</h3>
          <ul aria-hidden className="mt-3 rounded-lg border border-border bg-background px-3 py-1 leading-8">
            <li className="so-ke flex justify-between"><span>Kỳ 1 hốt</span><span>288,48</span></li>
            <li className="so-ke flex justify-between"><span>Kỳ 2 hốt</span><span>323,18</span></li>
            <li className="so-ke flex justify-between"><span>Ký quỹ còn</span><span>460,00</span></li>
          </ul>
          <p className="mt-2 text-muted-foreground">Ai cũng kiểm lại được. Xuất ra PDF khi cần.</p>
        </Cell>
        <Cell className="md:col-span-2">
          <h3 className="font-display text-2xl font-bold">Không cần ví, không phí mạng</h3>
          <Ticks items={['Đăng nhập bằng Google hoặc email', 'HụiSafe trả phí giao dịch', 'Không cần giữ AVAX']} />
        </Cell>
      </div>
    </section>
  );
}
