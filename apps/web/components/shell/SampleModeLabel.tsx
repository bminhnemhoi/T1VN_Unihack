/** Shown only while nothing is deployed on the network: the screens run on sample data and must say so. */
export function SampleModeLabel() {
  return (
    <p role="note" data-testid="sample-mode" className="border-b border-border bg-secondary px-4 py-1 text-center text-base text-secondary-foreground">
      Đang xem dữ liệu mẫu
    </p>
  );
}
