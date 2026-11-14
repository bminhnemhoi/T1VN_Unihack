/**
 * The HụiSafe mark (logo C, "lá thăm"): an envelope with a slanted flap and a lime seal carrying the U. Drawn by hand in
 * SVG so it stays sharp at any size (same geometry as public/brand/logo.svg). Ink parts follow `currentColor`; the body
 * is the ivory of the palette and the seal is lime.
 */
export function LogoMark({ height = 24, className }: { height?: number; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="160 290 704 452"
      width={Math.round((height * 704) / 452)}
      height={height}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="174" y="304" width="676" height="424" rx="6" fill="#f4f0e8" stroke="currentColor" strokeWidth="14" strokeLinejoin="round" />
      <path d="M174 430 L212 530 H812 L850 430" stroke="currentColor" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="512" cy="532" r="100" fill="#a1ff62" stroke="currentColor" strokeWidth="12" />
      <path d="M482 484 V539 A30 30 0 0 0 542 539 V484" stroke="currentColor" strokeWidth="28" />
    </svg>
  );
}
