import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  staticFile,
  Img,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { C, SHADOW_WINDOW } from "../tokens";
import { MONO, SANS } from "../fonts";

// Engine spike: perspective window, depth of field, word-by-word blur reveal,
// oversized cursor on a spring, rolling tabular number, status pill. Not the film.

const WordReveal: React.FC<{ text: string; start: number; size: number; color: string }> = ({
  text,
  start,
  size,
  color,
}) => {
  const frame = useCurrentFrame();
  const words = text.split(" ");
  return (
    <div style={{ display: "flex", gap: size * 0.26, flexWrap: "wrap", justifyContent: "center" }}>
      {words.map((w, i) => {
        const t0 = start + i * 5;
        const p = interpolate(frame, [t0, t0 + 30], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.25, 0.8, 0.25, 1),
        });
        return (
          <span
            key={i}
            style={{
              fontFamily: SANS,
              fontWeight: 900,
              fontSize: size,
              letterSpacing: "-0.045em",
              color,
              opacity: p,
              filter: `blur(${(1 - p) * 10}px)`,
              transform: `translateY(${(1 - p) * 18}px)`,
              display: "inline-block",
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

const Cursor: React.FC<{ x: number; y: number; press: number }> = ({ x, y, press }) => (
  <svg
    width={110}
    height={110}
    viewBox="0 0 24 24"
    style={{
      position: "absolute",
      left: x,
      top: y,
      transform: `scale(${1 - press * 0.16})`,
      transformOrigin: "21% 14%",
      filter: "drop-shadow(4px 8px 8px rgba(0,0,0,.3))",
    }}
  >
    <path d="M5 2.5 L5 19.5 L9.4 15.6 L12.3 21.6 L15.1 20.3 L12.2 14.4 L18.2 14.2 Z" fill="#1c1c1c" stroke="#fff" strokeWidth={1.4} strokeLinejoin="round" />
  </svg>
);

export const Spike: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 50 });
  const tiltY = interpolate(frame, [0, 180], [-7, -3]);
  const camZ = interpolate(frame, [0, 180], [0, 40]);
  const cx = interpolate(spring({ frame: frame - 40, fps, config: { damping: 200 }, durationInFrames: 45 }), [0, 1], [1500, 1180]);
  const cy = interpolate(spring({ frame: frame - 40, fps, config: { damping: 200 }, durationInFrames: 45 }), [0, 1], [1200, 610]);
  const press = interpolate(frame, [92, 98, 110], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const amount = interpolate(frame, [100, 150], [0, 31.2], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });

  return (
    <AbsoluteFill style={{ background: C.ivory, perspective: 2400, overflow: "hidden" }}>
      {/* soft background layer, out of focus */}
      <div style={{ position: "absolute", left: 120, top: 640, width: 520, height: 300, borderRadius: 14, background: C.paper, filter: "blur(9px)", opacity: 0.7 }} />
      {/* status pill */}
      <div style={{ position: "absolute", left: 64, top: 48, display: "flex", alignItems: "center", gap: 16, padding: "14px 22px", borderRadius: 999, background: C.paper, boxShadow: "0 1px 0 #DCD6CB, 6px 14px 28px -18px rgba(32,29,29,.45)", fontFamily: SANS, fontSize: 26, fontWeight: 600, color: C.ink }}>
        <Img src={staticFile("brand/huisafe-logo.svg")} style={{ height: 30 }} />
        <span>5 members · 10 USDC</span>
        <span style={{ color: C.ink2, fontWeight: 500 }}>Round 1/5</span>
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{ width: 34, height: 8, borderRadius: 2, background: i === 0 ? C.ink : C.line }} />
          ))}
        </div>
      </div>
      {/* window in 3D */}
      <div
        style={{
          position: "absolute",
          left: 360,
          top: 170,
          width: 1200,
          height: 760,
          borderRadius: 14,
          background: C.paper,
          border: `1px solid ${C.line}`,
          boxShadow: SHADOW_WINDOW,
          transform: `translateZ(${camZ}px) rotateY(${tiltY}deg) rotateX(3deg) translateY(${(1 - enter) * 120}px)`,
          opacity: enter,
          padding: 48,
          boxSizing: "border-box",
        }}
      >
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 44, letterSpacing: "-0.03em", color: C.ink }}>Bàn khui kỳ</div>
        <div style={{ marginTop: 8, fontFamily: SANS, fontSize: 22, color: C.ink2 }}>Kỳ 1 · dây 5 người × 10 USDC</div>
        <div style={{ marginTop: 60, display: "flex", alignItems: "baseline", gap: 14 }}>
          <span style={{ fontFamily: MONO, fontWeight: 500, fontSize: 96, fontVariantNumeric: "tabular-nums", color: C.ink }}>{amount.toFixed(2).replace(".", ",")}</span>
          <span style={{ fontFamily: MONO, fontSize: 32, color: C.ink2 }}>USDC</span>
        </div>
        <div style={{ position: "absolute", right: 48, bottom: 48, padding: "18px 30px", borderRadius: 4, background: C.lime, color: C.ink, fontFamily: SANS, fontWeight: 700, fontSize: 26, transform: `scale(${1 - press * 0.06})` }}>
          Khui kỳ 1
        </div>
      </div>
      <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 960 }}>
        <WordReveal text="Tiền nằm trong ví từng người." start={20} size={52} color={C.ink} />
      </AbsoluteFill>
      <Cursor x={cx} y={cy} press={press} />
    </AbsoluteFill>
  );
};
