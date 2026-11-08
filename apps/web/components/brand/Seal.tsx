import { useId } from 'react';

interface Props {
  size?: number;
  /** Large text in the middle. */
  center?: string;
  /** Text running around the ring. Keep it ~34 characters for a full circle. */
  ring?: string;
  className?: string;
}

/** Round red seal ("dấu") drawn with SVG. Colour comes from `currentColor`. Decorative: always aria-hidden. */
export function Seal({ size = 96, center = 'Hụi', ring = 'HỤISAFE · KHÔNG AI CẦM TIỀN · ', className }: Props) {
  const id = `seal-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true" className={className}>
      <circle cx="60" cy="60" r="57" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="60" cy="60" r="31" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <defs>
        <path id={id} d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0" />
      </defs>
      <text fontSize="10.5" fontWeight="700" letterSpacing="1.6" fill="currentColor">
        <textPath href={`#${id}`} startOffset="0">
          {ring}
        </textPath>
      </text>
      <text x="60" y="70" textAnchor="middle" fontSize={center.length > 3 ? 17 : 26} fontWeight="700" fill="currentColor" className="font-display">
        {center}
      </text>
    </svg>
  );
}
