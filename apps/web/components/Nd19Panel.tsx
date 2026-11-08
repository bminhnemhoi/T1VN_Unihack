import { DEFAULT_VND_PER_USDC, ND19_ARTICLE14_THRESHOLD_VND } from 'config';
import { formatUsdc, formatVnd, usdcToVnd } from 'sdk';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SoonButton } from '@/components/shell/SoonButton';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldLabel } from '@/components/ui/field';

interface Props {
  perRoundUsdc: bigint;
  hasActiveCircle: boolean;
  onHasActiveCircle: (v: boolean) => void;
  over18: boolean;
  onOver18: (v: boolean) => void;
}

/** "Nghị định 19" (AC-01.4 a, b, c, e; d is the commission switch in the form). */
export function Nd19Panel({ perRoundUsdc, hasActiveCircle, onHasActiveCircle, over18, onOver18 }: Props) {
  const vnd = usdcToVnd(perRoundUsdc, DEFAULT_VND_PER_USDC);
  const mustNotify = vnd >= BigInt(ND19_ARTICLE14_THRESHOLD_VND) || hasActiveCircle;
  return (
    <div>
      <h2 className="text-2xl font-bold">Nghị định 19</h2>
      <div className="mt-2 flex flex-col gap-2">
        <Field orientation="horizontal">
          <Checkbox id="over18" checked={over18} onCheckedChange={(v) => onOver18(v === true)} />
          <FieldLabel htmlFor="over18" className="min-h-12 flex-1 items-center font-normal">
            Tôi tự xác nhận đã đủ 18 tuổi (Điều 6)
          </FieldLabel>
        </Field>
        <Field orientation="horizontal">
          <Checkbox id="active" checked={hasActiveCircle} onCheckedChange={(v) => onHasActiveCircle(v === true)} />
          <FieldLabel htmlFor="active" className="min-h-12 flex-1 items-center font-normal">
            Tôi đang làm chủ hụi một dây khác (dữ liệu mẫu)
          </FieldLabel>
        </Field>
      </div>
      <p className="so-ke mt-3">
        Giá trị một kỳ: <strong>{formatUsdc(perRoundUsdc)}</strong> ≈ {formatVnd(vnd)}
        <span className="text-muted-foreground"> (quy đổi tham khảo, {DEFAULT_VND_PER_USDC.toLocaleString('vi-VN')} đ mỗi USDC)</span>
      </p>
      {mustNotify && (
        <Alert className="mt-3 border-nghe-fg bg-nghe-bg text-nghe-fg">
          <AlertDescription className="text-nghe-fg">
            Cần thông báo bằng văn bản cho UBND cấp xã (NĐ 19 Điều 14).
          </AlertDescription>
          <SoonButton variant="outline" className="mt-2 w-fit" message="Bản nháp thông báo gửi UBND cấp xã sẽ có khi nối ví. Hiện là màn hình mẫu.">
            Soạn thông báo
          </SoonButton>
        </Alert>
      )}
      <p className="mt-3 text-muted-foreground">Lãi chậm góp: 10%/năm (Điều 22 khoản 1).</p>
    </div>
  );
}
