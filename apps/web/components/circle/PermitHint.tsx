import { formatUsdc, type RepayPermitQuote } from 'sdk';

/**
 * What a late payment asks the member to sign (M-02, docs/05 section 8.2b): a permit SETS the allowance, so it covers this
 * payment, its late fee and the contributions still to come. `capped` means the need passed the ceiling the server accepts.
 */
export function PermitHint({ quote }: { quote: RepayPermitQuote }) {
  return (
    <p className="so-ke mt-2 text-foreground" data-testid="permit-hint">
      Bạn ký cấp cho dây trích tối đa <strong>{formatUsdc(quote.value)}</strong>: khoản này {formatUsdc(quote.quote.total)} và {formatUsdc(quote.futureContributions)} phần góp các kỳ còn lại. Không cần AVAX.
      {quote.capped && ' Số cần thật lớn hơn mức tối đa cho phép nên đã bị cắt; nếu còn thiếu, hãy báo chủ hụi.'}
    </p>
  );
}
