import qrcode from 'qrcode-generator';

/** Static QR code as one SVG path (no canvas, no image file). Error correction M. Quiet zone of 4 modules is included. */
export function QrCode({ text, label, size = 168 }: { text: string; label: string; size?: number }) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) d += `M${x + 4} ${y + 4}h1v1h-1z`;
  const box = n + 8;
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${box} ${box}`} width={size} height={size} shapeRendering="crispEdges" className="rounded-lg border border-border bg-white">
      <path d={d} fill="#201d1d" />
    </svg>
  );
}
