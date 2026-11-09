'use client';

import { useEffect, useState } from 'react';
import { RepBadge, RepDisclaimer } from '@/components/circle/RepBadge';
import { applyFontSize, FONT_KEY, readFontSize, type FontSize } from '@/components/shell/FontSizeInit';
import { SoonButton } from '@/components/shell/SoonButton';
import { useToast } from '@/components/shell/Toast';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { getSampleCircle } from '@/lib/sample-circles';
import { TOGGLE_ON } from '@/lib/utils';

const ME = getSampleCircle('demo').seats[1]!; // the sample viewer: Thành viên 2

/** S14: only the text size works for real today (it is stored in this browser); backup and reminders explain what they will do. */
export function SettingsView() {
  const { show } = useToast();
  const [size, setSize] = useState<FontSize>('normal');
  const [remind, setRemind] = useState(false);
  const [pass, setPass] = useState('');
  useEffect(() => setSize(readFontSize()), []);

  const change = (v: FontSize) => {
    setSize(v);
    applyFontSize(v);
    try {
      localStorage.setItem(FONT_KEY, v);
    } catch {
      show('Máy không cho lưu lựa chọn này, nên lần sau bạn cần chọn lại.', 'error');
    }
  };

  return (
    <main id="noi-dung" className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-h1 font-bold">Cài đặt</h1>
      <p className="mt-2 text-lead text-muted-foreground">Mọi lựa chọn ở đây chỉ nằm trên trình duyệt này.</p>

      <section aria-labelledby="co-chu" className="to-giay mt-8 p-6">
        <h2 id="co-chu" className="font-display text-h2 font-bold">
          Cỡ chữ
        </h2>
        <p id="co-chu-nhan" className="mt-1 text-muted-foreground">
          Chữ lớn tăng toàn bộ chữ trong ứng dụng từ 18 lên 22 điểm.
        </p>
        <ToggleGroup type="single" variant="outline" value={size} onValueChange={(v) => v && change(v as FontSize)} aria-labelledby="co-chu-nhan" className="mt-2">
          <ToggleGroupItem value="normal" className={TOGGLE_ON}>Chữ thường</ToggleGroupItem>
          <ToggleGroupItem value="large" className={TOGGLE_ON}>Chữ lớn</ToggleGroupItem>
        </ToggleGroup>
        <p className="mt-3 rounded-lg bg-secondary p-3">Câu mẫu: thăm cao nhất được hốt, không có may rủi.</p>
      </section>

      <section aria-labelledby="sao-luu" className="o-phang mt-6 p-6">
        <h2 id="sao-luu" className="font-display text-h2 font-bold">
          Sao lưu thăm
        </h2>
        <p className="mt-1 max-w-prose text-muted-foreground">
          Thăm niêm phong được khóa bằng một mã bí mật chỉ lưu trên máy này. Đổi máy hoặc xóa dữ liệu trình duyệt mà chưa sao lưu thì không mở được thăm và mất cọc mở thăm.
        </p>
        <Field className="mt-3">
          <FieldLabel htmlFor="mat-khau">Mật khẩu để mã hóa file sao lưu</FieldLabel>
          <Input id="mat-khau" type="password" autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} className="max-w-sm" />
          <FieldDescription>Mật khẩu không gửi đi đâu. Quên mật khẩu thì file sao lưu không mở được.</FieldDescription>
        </Field>
        <div className="mt-3 flex flex-wrap gap-3">
          <SoonButton
            size="lg"
            message={pass.length < 8 ? 'Hãy nhập mật khẩu dài ít nhất 8 ký tự trước. Hiện chưa có thăm nào trên máy này để sao lưu, vì đây là màn hình mẫu.' : 'Chưa có thăm niêm phong nào trên máy này để sao lưu. Khi nộp thăm thật, nút này tải file mã hóa.'}
          >
            Sao lưu thăm
          </SoonButton>
          <SoonButton size="lg" variant="outline" message="Nhập file sao lưu để mở thăm trên máy mới, sắp có cùng lúc với nộp thăm thật.">
            Nhập file sao lưu
          </SoonButton>
        </div>
      </section>

      <section aria-labelledby="nhac" className="o-phang mt-6 p-6">
        <h2 id="nhac" className="font-display text-h2 font-bold">
          Nhắc hụi qua Telegram
        </h2>
        <p className="mt-1 text-muted-foreground">Phần thêm, tự chọn. Nhắc trước giờ đóng nộp thăm và trước hạn góp.</p>
        <label htmlFor="nhac-bat" className="mt-3 flex min-h-12 cursor-pointer items-center gap-3">
          <Switch
            id="nhac-bat"
            checked={remind}
            onCheckedChange={(v) => {
              setRemind(v);
              if (v) show('Nhắc hụi qua Telegram cần đăng nhập và liên kết tài khoản, sắp có. Hiện là màn hình mẫu, chưa có tin nhắn nào được gửi.');
            }}
          />
          Bật nhắc hụi
        </label>
      </section>

      <section aria-labelledby="huy-hieu" className="o-phang mt-6 p-6">
        <h2 id="huy-hieu" className="font-display text-h2 font-bold">
          Huy hiệu của bạn
        </h2>
        <div className="mt-2">
          <RepBadge rep={ME.rep} showNext />
        </div>
        <RepDisclaimer className="mt-3" />
      </section>
    </main>
  );
}
