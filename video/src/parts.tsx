import React from "react";
import { Img, staticFile } from "remotion";
import { C, SHADOW_BUBBLE, SHADOW_WINDOW } from "./tokens";
import { MONO, SANS } from "./fonts";

// Shared pieces of the film. Product UI is rebuilt from apps/web (tokens in DESIGN.md, strings from the components).

export const Mono: React.FC<{ size?: number; color?: string; weight?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({ size = 22, color = C.ink2, weight = 500, style, children }) => (
  <span style={{ fontFamily: MONO, fontSize: size, color, fontWeight: weight, fontVariantNumeric: "tabular-nums", ...style }}>{children}</span>
);

export const Label: React.FC<{ children: React.ReactNode; tone?: "lime" | "ink" | "line" | "red"; size?: number; style?: React.CSSProperties }> = ({ children, tone = "lime", size = 16, style }) => {
  const bg = tone === "lime" ? C.lime : tone === "ink" ? C.ink : tone === "red" ? C.red : "transparent";
  const fg = tone === "ink" ? C.lime : C.ink;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: `${size * 0.35}px ${size * 0.6}px`, borderRadius: 4, background: bg, border: tone === "line" ? `1.5px solid ${C.line}` : "none", fontFamily: MONO, fontWeight: 600, fontSize: size, letterSpacing: "0.06em", color: fg, textTransform: "uppercase", ...style }}>
      {children}
    </span>
  );
};

// The lá thăm mark from apps/web/public/brand/logo.svg, drawn in code so it stays sharp at any size.
export const Envelope: React.FC<{ width: number; sealed?: boolean; style?: React.CSSProperties; dark?: boolean }> = ({ width, sealed = true, style, dark }) => (
  <svg viewBox="160 290 704 452" width={width} height={(width * 452) / 704} style={style}>
    <rect x="174" y="304" width="676" height="424" rx="6" fill={dark ? C.ivory : C.ivory} stroke={C.ink} strokeWidth="14" strokeLinejoin="round" />
    <path d="M174 430 L212 530 H812 L850 430" fill="none" stroke={C.ink} strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
    {sealed && (
      <>
        <circle cx="512" cy="532" r="100" fill={C.lime} stroke={C.ink} strokeWidth="12" />
        <path d="M482 484 V539 A30 30 0 0 0 542 539 V484" fill="none" stroke={C.ink} strokeWidth="28" />
      </>
    )}
  </svg>
);

export const Coin: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => (
  <div style={{ width: size, height: size, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #4C8DF0 0%, #2775CA 55%, #1B5AA3 100%)", boxShadow: "inset 0 -4px 0 rgba(0,0,0,.18), 4px 8px 14px -6px rgba(21,19,19,.45)", ...style }} />
);

export const StatusPill: React.FC<{ text: string; sub?: string; done?: number; total?: number; style?: React.CSSProperties }> = ({ text, sub, done = 0, total = 5, style }) => (
  <div style={{ position: "absolute", left: 56, top: 44, display: "flex", alignItems: "center", gap: 18, padding: "14px 24px 14px 18px", borderRadius: 999, background: C.paper, boxShadow: `0 0 0 1px ${C.line}, ${SHADOW_BUBBLE}`, fontFamily: SANS, fontSize: 26, fontWeight: 650, color: C.ink, ...style }}>
    <Envelope width={46} />
    <span>{text}</span>
    {sub && <span style={{ color: C.ink2, fontWeight: 500 }}>{sub}</span>}
    <div style={{ display: "flex", gap: 6 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{ width: 34, height: 8, borderRadius: 2, background: i < done ? C.ink : i === done ? C.lime : C.line }} />
      ))}
    </div>
    <Label size={15}>DEMO · Fuji</Label>
  </div>
);

export const AppWindow: React.FC<{ left: number; top: number; width: number; height: number; url?: string; children?: React.ReactNode; style?: React.CSSProperties; blur?: number }> = ({ left, top, width, height, url = "lamng.tail3abf4e.ts.net", children, style, blur = 0 }) => (
  <div style={{ position: "absolute", left, top, width, height, borderRadius: 14, background: C.paper, boxShadow: `0 0 0 1px ${C.line}, ${SHADOW_WINDOW}`, overflow: "hidden", filter: blur ? `blur(${blur}px)` : undefined, ...style }}>
    <div style={{ height: 52, display: "flex", alignItems: "center", gap: 10, padding: "0 20px", borderBottom: `1px solid ${C.line}`, background: C.ivory }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ width: 13, height: 13, borderRadius: "50%", background: C.line }} />
      ))}
      <div style={{ marginLeft: 18, flex: "none", padding: "6px 18px", borderRadius: 999, background: C.paper, border: `1px solid ${C.line}` }}>
        <Mono size={17} color={C.ink2}>{url}</Mono>
      </div>
    </div>
    <div style={{ position: "relative", height: height - 52 }}>{children}</div>
  </div>
);

export const Phone: React.FC<{ left: number; top: number; width?: number; children?: React.ReactNode; style?: React.CSSProperties }> = ({ left, top, width = 400, children, style }) => {
  const h = width * 2.06;
  return (
    <div style={{ position: "absolute", left, top, width, height: h, borderRadius: width * 0.15, background: "#0E0D0D", padding: width * 0.03, boxSizing: "border-box", boxShadow: `inset 0 0 0 2px #3A3636, ${SHADOW_WINDOW}`, ...style }}>
      <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: width * 0.125, overflow: "hidden", background: C.ivory }}>
        <div style={{ position: "absolute", top: width * 0.03, left: "50%", transform: "translateX(-50%)", width: width * 0.3, height: width * 0.085, borderRadius: 999, background: "#0E0D0D", zIndex: 5 }} />
        <div style={{ position: "absolute", top: width * 0.04, left: width * 0.09, fontFamily: SANS, fontWeight: 650, fontSize: width * 0.042, color: C.ink, zIndex: 4 }}>9:41</div>
        <div style={{ position: "absolute", inset: 0, paddingTop: width * 0.16 }}>{children}</div>
        <div style={{ position: "absolute", bottom: width * 0.022, left: "50%", transform: "translateX(-50%)", width: width * 0.34, height: 5, borderRadius: 3, background: C.ink, opacity: 0.85 }} />
      </div>
    </div>
  );
};

export const Cursor: React.FC<{ x: number; y: number; size?: number; press?: number }> = ({ x, y, size = 96, press = 0 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ position: "absolute", left: x - size * 0.21, top: y - size * 0.14, transform: `scale(${1 - press * 0.16})`, transformOrigin: "21% 14%", filter: "drop-shadow(4px 8px 7px rgba(21,19,19,.32))", zIndex: 50 }}>
    <path d="M5 2.5 L5 19.5 L9.4 15.6 L12.3 21.6 L15.1 20.3 L12.2 14.4 L18.2 14.2 Z" fill="#1c1c1c" stroke="#fff" strokeWidth={1.4} strokeLinejoin="round" />
  </svg>
);

export const Touch: React.FC<{ x: number; y: number; size?: number }> = ({ x, y, size = 74 }) => (
  <div style={{ position: "absolute", left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: "50%", background: "rgba(32,29,29,.22)", border: "2px solid rgba(255,255,255,.9)", boxShadow: "0 6px 16px rgba(21,19,19,.25)", zIndex: 50 }} />
);

export const Subtitle: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ position: "absolute", left: 0, right: 0, bottom: 64, display: "flex", justifyContent: "center", zIndex: 80 }}>
    <div style={{ maxWidth: 1000, padding: "12px 26px", borderRadius: 14, background: "rgba(21,19,19,.72)", color: "#FBF9F4", fontFamily: SANS, fontWeight: 560, fontSize: 35, lineHeight: 1.25, textAlign: "center" }}>{text}</div>
  </div>
);

export const LimeButton: React.FC<{ children: React.ReactNode; size?: number; dim?: boolean; style?: React.CSSProperties }> = ({ children, size = 22, dim, style }) => (
  <div style={{ display: "inline-flex", alignItems: "center", gap: size * 0.6, padding: `${size * 0.72}px ${size * 1.1}px`, borderRadius: 4, background: dim ? C.line : C.lime, color: dim ? C.ink2 : C.ink, fontFamily: SANS, fontWeight: 650, fontSize: size, ...style }}>
    {children}
  </div>
);

export const BrandImg: React.FC<{ file: string; height: number; style?: React.CSSProperties }> = ({ file, height, style }) => (
  <Img src={staticFile(`brand/${file}`)} style={{ height, ...style }} />
);
