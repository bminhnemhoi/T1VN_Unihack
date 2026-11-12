/** Shown only while nothing is deployed on the network: the screens run on sample data and must say so. */
export function SampleModeLabel() {
  return (
    <p role="note" data-testid="sample-mode" className="font-mono border-b border-border bg-secondary px-4 py-1 text-center text-[0.72rem] tracking-[0.06em] text-muted-foreground uppercase">
      Đang xem dữ liệu mẫu
    </p>
  );
}
