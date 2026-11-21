import React from "react";
import { Easing } from "remotion";
import { MONO, SANS } from "./fonts";

// Easing vocabulary (stageshow motion.md, cut-the-curve): one curve per job.
export const E = {
  travel: Easing.bezier(0.45, 0, 0.1, 1), // a thing moving from A to B
  arrive: Easing.bezier(0.25, 0.8, 0.25, 1), // a thing arriving from nowhere
  in4: Easing.in(Easing.poly(4)), // exit half of a cut-the-curve
  out4: Easing.out(Easing.poly(4)), // entry half of a cut-the-curve
  outExpo: Easing.out(Easing.exp),
  inOut: Easing.inOut(Easing.cubic),
  sine: Easing.inOut(Easing.sin),
  ui: Easing.bezier(0.3, 0.75, 0.1, 1), // product-speed UI response
  linear: (x: number) => x,
};

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const mix = (a: number, b: number, p: number) => a + (b - a) * p;
// Eased progress of a move that starts at `start` (s) and lasts `dur` (s), at time t.
// Ends are exact (some curves, like out(exp), stop at 0.999 and would leave a count short of its value).
export const P = (t: number, start: number, dur: number, ease: (x: number) => number = E.arrive) => {
  if (dur <= 0) return t >= start ? 1 : 0;
  const x = (t - start) / dur;
  return x <= 0 ? 0 : x >= 1 ? 1 : ease(x);
};
// Value along keyframes [[t, v], ...] with an ease per segment (holds between keys are flat).
export const keys = (t: number, k: [number, number][], ease: (x: number) => number = E.travel) => {
  if (t <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) {
    if (t <= k[i][0]) return mix(k[i - 1][1], k[i][1], ease(clamp((t - k[i - 1][0]) / (k[i][0] - k[i - 1][0]))));
  }
  return k[k.length - 1][1];
};

// Word-by-word reveal: each word fades up from blurred to sharp with a small rise (style-rules.md, Text).
export const Words: React.FC<{
  t: number;
  text: string;
  start: number;
  size: number;
  color: string;
  weight?: number;
  stagger?: number;
  dur?: number;
  exitAt?: number;
  align?: "left" | "center";
  mono?: boolean;
  lineHeight?: number;
  tracking?: string;
  style?: React.CSSProperties;
  maxWidth?: number;
}> = ({ t, text, start, size, color, weight = 900, stagger = 0.07, dur = 0.55, exitAt, align = "center", mono, lineHeight = 1.04, tracking, style, maxWidth }) => {
  const words = text.split(" ");
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: align === "center" ? "center" : "flex-start", columnGap: size * 0.24, rowGap: size * 0.06, maxWidth, ...style }}>
      {words.map((w, i) => {
        const p = P(t, start + i * stagger, dur, E.arrive);
        const x = exitAt === undefined ? 0 : P(t, exitAt + i * 0.022, 0.34, E.in4);
        const o = p * (1 - clamp(x * 3.2));
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              fontFamily: mono ? MONO : SANS,
              fontWeight: weight,
              fontSize: size,
              lineHeight,
              letterSpacing: tracking ?? (mono ? "0" : "-0.045em"),
              color,
              opacity: o,
              filter: `blur(${((1 - p) * 10 + x * 8).toFixed(2)}px)`,
              transform: `translate(${-x * 230}px, ${(1 - p) * size * 0.28}px)`,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

// Number formatting: UI keeps the app's vi-VN style ("28,848"), English text uses a dot ("28.848").
export const fmt = (v: number, decimals: number, style: "vi" | "en" = "vi") => {
  const s = v.toFixed(decimals);
  return style === "vi" ? s.replace(".", ",") : s;
};

// A value that counts up between two times; digits stay fixed-width (tabular).
export const countTo = (t: number, start: number, dur: number, from: number, to: number) => mix(from, to, P(t, start, dur, E.outExpo));

// Oversized macOS-style cursor (oversized-cursor skill): tip on the target, press pivots on the tip.
export const Cursor: React.FC<{ x: number; y: number; size?: number; press?: number; opacity?: number }> = ({ x, y, size = 92, press = 0, opacity = 1 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    style={{
      position: "absolute",
      left: x - size * 0.21,
      top: y - size * 0.14,
      transform: `scale(${1 - press * 0.16})`,
      transformOrigin: "21% 14%",
      filter: "drop-shadow(4px 8px 7px rgba(21,19,19,.32))",
      opacity,
      zIndex: 60,
      overflow: "visible",
    }}
  >
    <path d="M5 2.5 L5 19.5 L9.4 15.6 L12.3 21.6 L15.1 20.3 L12.2 14.4 L18.2 14.2 Z" fill="#1c1c1c" stroke="#fff" strokeWidth={1.4} strokeLinejoin="round" />
  </svg>
);

// Press curve for a click at time c: quick compress, slower release (1:2).
export const press = (t: number, c: number) => (t < c ? 0 : t < c + 0.1 ? (t - c) / 0.1 : t < c + 0.32 ? 1 - (t - c - 0.1) / 0.22 : 0);

// Path for a cursor: [[t, x, y], ...], travel ease per leg.
export const path = (t: number, k: [number, number, number][]) => ({
  x: keys(t, k.map(([a, x]) => [a, x] as [number, number])),
  y: keys(t, k.map(([a, , y]) => [a, y] as [number, number])),
});

// A finger tap on a phone: a soft disc that appears, presses and fades.
export const Tap: React.FC<{ t: number; at: number; x: number; y: number; size?: number }> = ({ t, at, x, y, size = 70 }) => {
  const a = P(t, at - 0.25, 0.2, E.arrive);
  const out = P(t, at + 0.25, 0.35, E.sine);
  const o = a * (1 - out);
  if (o <= 0.001) return null;
  const s = 1 - press(t, at) * 0.18;
  return (
    <div style={{ position: "absolute", left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: "50%", background: "rgba(32,29,29,.22)", border: "2px solid rgba(255,255,255,.9)", boxShadow: "0 6px 16px rgba(21,19,19,.25)", opacity: o, transform: `scale(${s})`, zIndex: 60 }} />
  );
};
