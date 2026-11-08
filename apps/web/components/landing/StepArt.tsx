/** Four small ledger-style illustrations, one per step. Decorative (aria-hidden); colours from tokens. */
const svgProps = { viewBox: '0 0 220 110', 'aria-hidden': true, className: 'h-28 w-full' } as const;

export function ArtGop() {
  return (
    <svg {...svgProps}>
      {[30, 60, 90].map((y, i) => (
        <g key={y}>
          <rect x="10" y={y - 12} width="44" height="24" rx="6" fill="var(--secondary)" stroke="var(--foreground)" strokeWidth="2" />
          <text x="32" y={y + 5} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--foreground)">
            100
          </text>
          <path d={`M58 ${y} C 90 ${y}, 100 55, 130 55`} fill="none" stroke="var(--primary)" strokeWidth="2" strokeDasharray="4 4" />
          <title>{`Ví ${i + 1}`}</title>
        </g>
      ))}
      <circle cx="165" cy="55" r="36" fill="var(--card)" stroke="var(--foreground)" strokeWidth="2.5" />
      <text x="165" y="52" textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--muted-foreground)">
        Kỳ 1
      </text>
      <text x="165" y="70" textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--foreground)" className="font-display">
        376
      </text>
    </svg>
  );
}

export function ArtThamKin() {
  return (
    <svg {...svgProps}>
      <rect x="40" y="26" width="140" height="68" rx="8" fill="var(--card)" stroke="var(--foreground)" strokeWidth="2.5" />
      <path d="M40 30 L110 66 L180 30" fill="none" stroke="var(--foreground)" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="110" cy="66" r="15" fill="var(--le-do)" />
      <text x="110" y="72" textAnchor="middle" fontSize="15" fontWeight="700" fill="#fff" className="font-display">
        Hụi
      </text>
      <path d="M92 22 v-6 a18 18 0 0 1 36 0 v6" fill="none" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function ArtHot() {
  return (
    <svg {...svgProps}>
      <circle cx="55" cy="40" r="16" fill="var(--secondary)" stroke="var(--foreground)" strokeWidth="2.5" />
      <path d="M25 92 a30 30 0 0 1 60 0 z" fill="var(--secondary)" stroke="var(--foreground)" strokeWidth="2.5" />
      <path d="M100 56 H138" stroke="var(--ngoc)" strokeWidth="3" strokeLinecap="round" />
      <path d="M130 48 l10 8 l-10 8" fill="none" stroke="var(--ngoc)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="146" y="30" width="68" height="50" rx="8" fill="var(--card)" stroke="var(--ngoc)" strokeWidth="2.5" />
      <text x="180" y="52" textAnchor="middle" fontSize="10.5" fontWeight="600" fill="var(--muted-foreground)">
        Nhận
      </text>
      <text x="180" y="70" textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--ngoc)" className="font-display">
        323,18
      </text>
    </svg>
  );
}

export function ArtBu() {
  // Waterfall of cover: holdback first, then the organizer's bond, then the reserve fund. Same line style as the other steps.
  const boxes = [
    { x: 4, label: 'Giữ lại', v: '80', c: 'var(--primary)' },
    { x: 80, label: 'Ký quỹ', v: '20', c: 'var(--le-do)' },
    { x: 156, label: 'Dự phòng', v: '0', c: 'var(--ngoc)' },
  ];
  return (
    <svg {...svgProps}>
      {boxes.map((b, i) => (
        <g key={b.label}>
          <rect x={b.x} y="28" width="60" height="54" rx="8" fill="var(--card)" stroke={b.c} strokeWidth="2.5" />
          <text x={b.x + 30} y="48" textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--muted-foreground)">
            {b.label}
          </text>
          <text x={b.x + 30} y="70" textAnchor="middle" fontSize="18" fontWeight="700" fill={b.c} className="font-display">
            {b.v}
          </text>
          {i < boxes.length - 1 && (
            <g stroke="var(--foreground)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
              <path d={`M${b.x + 64} 55 H${b.x + 74}`} />
              <path d={`M${b.x + 70} 49 l6 6 l-6 6`} />
            </g>
          )}
        </g>
      ))}
    </svg>
  );
}
