import React from "react";
import { Img, staticFile } from "remotion";
import { C } from "./tokens";

// The three objects of the film, drawn as vectors so they stay sharp at any push-in. When Astra's 3D renders arrive
// in public/3d/ they can replace these one by one (same box, same anchor); any render that looks wrong stays vector.

// The lá thăm mark (apps/web/public/brand/logo.svg). flap 0 = open, 1 = folded down; seal 0..1 = stamp progress.
// sealFade, when given, shows the seal at rest and only fades it in (a 3D seal has just stamped on top of it).
export const SealedEnvelope: React.FC<{ width: number; flap?: number; seal?: number; sealFade?: number; style?: React.CSSProperties }> = ({ width, flap = 1, seal: sealIn = 1, sealFade, style }) => {
  const fy = 304 + (530 - 304) * flap; // fold line apex
  const sy = 304 + (430 - 304) * flap; // fold line ends on the sides
  const seal = sealFade === undefined ? sealIn : sealFade > 0 ? 1 : 0;
  const s = 0.6 + 0.4 * seal;
  return (
    <svg viewBox="160 290 704 452" width={width} height={(width * 452) / 704} style={{ overflow: "visible", ...style }}>
      <rect x="174" y="304" width="676" height="424" rx="6" fill={C.ivory} stroke={C.ink} strokeWidth="14" strokeLinejoin="round" />
      <path d={`M174 ${sy} L212 ${fy} H812 L850 ${sy}`} fill="none" stroke={C.ink} strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
      {seal > 0 && (
        <g transform={`translate(512 532) scale(${(1 / s) * (1 + (1 - seal) * 0.35)}) translate(-512 -532)`} opacity={sealFade ?? Math.min(1, seal * 1.6)}>
          <circle cx="512" cy="532" r="100" fill={C.lime} stroke={C.ink} strokeWidth="12" />
          <path d="M482 484 V539 A30 30 0 0 0 542 539 V484" fill="none" stroke={C.ink} strokeWidth="28" />
        </g>
      )}
    </svg>
  );
};

// A plain USDC-blue coin with no mark on it (the official USDC logo is not drawn by hand).
export const Coin: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => (
  <div style={{ width: size, height: size, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #5B98F2 0%, #2775CA 55%, #1B5AA3 100%)", boxShadow: `inset 0 ${-size * 0.08}px 0 rgba(0,0,0,.18), inset 0 0 0 ${size * 0.06}px rgba(255,255,255,.18), ${size * 0.08}px ${size * 0.18}px ${size * 0.3}px -${size * 0.12}px rgba(0,0,0,.55)`, ...style }} />
);

// An old clay pot (hũ). crack 0..1 draws a red crack down its belly.
export const Jar: React.FC<{ width: number; crack?: number; style?: React.CSSProperties }> = ({ width, crack = 0, style }) => {
  const crackLen = 190;
  return (
    <svg viewBox="0 0 200 220" width={width} height={width * 1.1} style={{ overflow: "visible", ...style }}>
      <defs>
        <radialGradient id="jarShade" cx="0.35" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#C2643A" />
          <stop offset="0.55" stopColor="#A0491F" />
          <stop offset="1" stopColor="#6E2E12" />
        </radialGradient>
      </defs>
      <ellipse cx="108" cy="208" rx="74" ry="9" fill="rgba(0,0,0,.45)" />
      <path d="M62 30 h76 v14 c0 8 -10 12 -10 22 c26 14 46 40 46 74 c0 40 -30 66 -74 66 c-44 0 -74 -26 -74 -66 c0 -34 20 -60 46 -74 c0 -10 -10 -14 -10 -22 z" fill="url(#jarShade)" stroke={C.ink} strokeWidth="4" />
      <ellipse cx="100" cy="31" rx="38" ry="7" fill="#7A3416" stroke={C.ink} strokeWidth="3" />
      <path d="M38 118 c32 12 92 12 124 0" fill="none" stroke="#7A3416" strokeWidth="4" />
      {crack > 0 && (
        <path d="M104 66 l-14 30 l18 18 l-16 30 l12 22 l-8 34" fill="none" stroke={C.red} strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={crackLen} strokeDashoffset={crackLen * (1 - crack)} />
      )}
    </svg>
  );
};

// ---------- Astra's 3D renders (public/3d, 2048 px, transparent). Each is cropped to its visible box. ----------

const BOX: Record<string, [number, number, number, number]> = {
  envelope_front: [245, 559, 1802, 1488],
  envelope_open: [258, 244, 1790, 1803],
  envelope_34_left: [244, 467, 1804, 1580],
  envelope_34_right: [244, 468, 1803, 1580],
  coin_front: [244, 246, 1802, 1803],
  coin_34: [466, 243, 1579, 1802],
  coin_edge: [843, 243, 1205, 1802],
  jar_whole: [281, 244, 1766, 1802],
  jar_cracked: [280, 243, 1767, 1802],
  jar_shards: [283, 243, 1764, 1802],
  seal_only: [244, 244, 1803, 1802],
};
const DROP = "drop-shadow(12px 22px 22px rgba(0,0,0,.42))";

// The render shown so its visible box is `width` wide, positioned at the box's top-left.
export const Obj3D: React.FC<{ name: keyof typeof BOX; width: number; opacity?: number; style?: React.CSSProperties; shadow?: boolean }> = ({ name, width, opacity = 1, style, shadow = true }) => {
  const [x0, y0, x1, y1] = BOX[name];
  const k = width / (x1 - x0);
  return (
    <div style={{ position: "relative", width, height: (y1 - y0) * k, opacity, filter: shadow ? DROP : undefined, ...style }}>
      <Img src={staticFile(`3d/${name}.png`)} style={{ position: "absolute", width: 2048 * k, height: 2048 * k, left: -x0 * k, top: -y0 * k, maxWidth: "none" }} />
    </div>
  );
};

// The ballot envelope: open (flap up) -> closed, and the seal stamping down. Box = the closed envelope's body.
export const Envelope3D: React.FC<{ width: number; close?: number; stamp?: number; style?: React.CSSProperties }> = ({ width, close = 1, stamp = 1, style }) => {
  const k = width / (1802 - 245);
  const h = (1488 - 559) * k;
  const sealW = width * 0.285 * (1 + (1 - stamp) * 0.4);
  return (
    <div style={{ position: "relative", width, height: h, filter: DROP, ...style }}>
      {close > 0 && <Img src={staticFile("3d/envelope_front.png")} style={{ position: "absolute", width: 2048 * k, height: 2048 * k, left: -245 * k, top: -559 * k, maxWidth: "none" }} />}
      {close < 1 && <Img src={staticFile("3d/envelope_open.png")} style={{ position: "absolute", width: 2048 * k, height: 2048 * k, left: -245 * k, top: h - 1803 * k, maxWidth: "none", opacity: 1 - close }} />}
      {stamp > 0 && stamp < 1 && (
        <Img src={staticFile("3d/seal_only.png")} style={{ position: "absolute", width: sealW * (2048 / 1559), height: sealW * (2048 / 1559), left: width * 0.4955 - (sealW * (2048 / 1559)) / 2, top: h * 0.526 - (sealW * (2048 / 1559)) / 2, maxWidth: "none", opacity: Math.min(1, stamp * 3) }} />
      )}
    </div>
  );
};

// A flying coin that turns about its vertical axis. spin counts turns; the render shown (front, 3/4, edge) is the one
// whose width is nearest the coin's apparent width |cos θ|, then stretched a little in x toward it, and mirrored on the
// quarters where the rim faces the other way. Default spin 0.125 = the plain 3/4 view. Centred on (x, y).
const COIN_W = { coin_front: 1558 / 1557, coin_34: 1113 / 1559, coin_edge: 362 / 1559 } as const;
export const Coin3D: React.FC<{ size: number; x: number; y: number; opacity?: number; tilt?: number; spin?: number }> = ({ size, x, y, opacity = 1, tilt = 0, spin = 0.125 }) => {
  const th = spin * 2 * Math.PI;
  const a = Math.abs(Math.cos(th));
  const name = a > 0.845 ? "coin_front" : a > 0.407 ? "coin_34" : "coin_edge";
  const w = size * COIN_W[name];
  const sx = Math.min(1.25, Math.max(0.8, Math.max(a, COIN_W.coin_edge) / COIN_W[name]));
  const flip = Math.cos(th) * Math.sin(th) < 0 ? -1 : 1;
  return <Obj3D name={name} width={w} opacity={opacity} style={{ position: "absolute", left: x - w / 2, top: y - size / 2, transform: `rotate(${tilt}deg) scaleX(${sx * flip})` }} />;
};

// The clay pot: whole, cracked, in shards (the three renders share one frame, so they swap in place).
export const Jar3D: React.FC<{ width: number; state: number; style?: React.CSSProperties }> = ({ width, state, style }) => {
  const k = width / (1766 - 281);
  const h = (1802 - 244) * k;
  const layer = (name: string, o: number) => (o > 0.001 ? <Img src={staticFile(`3d/${name}.png`)} style={{ position: "absolute", width: 2048 * k, height: 2048 * k, left: -281 * k, top: -244 * k, maxWidth: "none", opacity: o }} /> : null);
  const a = Math.min(1, Math.max(0, state)), b = Math.min(1, Math.max(0, state - 1));
  return (
    <div style={{ position: "relative", width, height: h, filter: DROP, ...style }}>
      {b > 0 && layer("jar_shards", 1)}
      {a > 0 && layer("jar_cracked", 1 - b)}
      {layer("jar_whole", 1 - a)}
    </div>
  );
};
