import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { C } from "../tokens";
import { MONO, SANS } from "../fonts";
import { E, P, Words, clamp, mix } from "../anim";
import { chunk, line } from "../plan";
import { Obj3D, SealedEnvelope } from "../objects";
import { SEAM_2_3 } from "./Act2";

// Act 3 on ink: proof from real page captures, the organisers' three questions, the end card.

const Browser: React.FC<{ url: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ url, children, style }) => (
  <div style={{ position: "absolute", left: 90, top: 150, width: 1080, height: 700, borderRadius: 14, overflow: "hidden", background: "#fff", boxShadow: "0 0 0 1px #3A3636, 18px 40px 80px -30px rgba(0,0,0,.75)", ...style }}>
    <div style={{ height: 50, display: "flex", alignItems: "center", gap: 10, padding: "0 18px", background: "#F2F2F2", borderBottom: "1px solid #DDD" }}>
      {[0, 1, 2].map((i) => <div key={i} style={{ width: 12, height: 12, borderRadius: "50%", background: "#CFCFCF" }} />)}
      <div style={{ marginLeft: 16, padding: "5px 16px", borderRadius: 999, background: "#fff", border: "1px solid #DDD", fontFamily: MONO, fontSize: 16, color: "#555" }}>{url}</div>
    </div>
    <div style={{ position: "relative", height: 650, overflow: "hidden" }}>{children}</div>
  </div>
);

const Stat: React.FC<{ t: number; at: number; n: string; label: string; size?: number }> = ({ t, at, n, label, size = 120 }) => {
  const p = P(t, at, 0.55, E.arrive);
  return (
    <div style={{ opacity: p, transform: `translateY(${(1 - p) * 30}px)`, filter: `blur(${(1 - p) * 8}px)` }}>
      <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: size, letterSpacing: "-0.05em", lineHeight: 1, color: C.lime }}>{n}</div>
      <div style={{ marginTop: 8, fontFamily: SANS, fontSize: 32, color: C.ivory, lineHeight: 1.25 }}>{label}</div>
    </div>
  );
};

export const Act3: React.FC<{ t: number }> = ({ t }) => {
  const s0 = SEAM_2_3();
  const L27 = line("L27"), L28 = line("L28"), L29 = line("L29"), L30 = line("L30"), L31 = line("L31");

  // zoom-through entry: arrives small and soft, keeps growing into focus (same push as the exit)
  const zin = P(t, s0, 0.55, E.outExpo);
  const zs = mix(0.75, 1, zin);
  const zb = (1 - zin) * 18;

  // S12 -> S13: everything rises out (a conclusion)
  const up12 = P(t, L27.end + 0.25, 0.5, E.in4);
  // the page scrolls to its transaction list while the view tightens on it, so settleRound and finalize read
  const pageZoom = P(t, s0 + 1.2, 4.6, E.inOut);
  const pageW = mix(1080, 1460, pageZoom);
  const scroll1 = P(t, s0 + 0.6, 5.2, E.inOut) * (1015 * (pageW / 1280) - 330);
  const swap = P(t, L27.start - 0.15, 0.35, E.ui);

  // S13 questions
  const q1 = L28.start, q2 = L29.start, q3 = L30.start;
  const up13 = P(t, L30.end + 0.25, 0.55, E.in4);
  const qPos = (i: number) => {
    // [top, size, opacity] by how many questions have arrived
    const n2 = P(t, q2 - 0.15, 0.7, E.travel), n3 = P(t, q3 - 0.15, 0.7, E.travel);
    if (i === 0) return { top: mix(mix(330, 120, n2), 70, n3), size: mix(104, 58, n2), o: mix(1, 0.38, n2) };
    if (i === 1) return { top: mix(330, 170, n3), size: mix(104, 58, n3), o: mix(1, 0.38, n3) };
    return { top: 330, size: 96, o: 1 };
  };
  const speed = P(t, chunk("L29", 1) + 0.15, 1.0, E.linear);

  // S14
  // the closing line is fully gone (opacity 0 at lineOut 1/3, ~160.38 s) before the logo starts: no overlap, no dissolve
  const lineOut = P(t, chunk("L31", 2) - 0.42, 0.32, E.in4);
  const logo = P(t, chunk("L31", 2) - 0.08, 0.7, E.arrive);
  const stamp = P(t, chunk("L31", 2) + 0.35, 0.22, E.outExpo);
  const stampEnd = chunk("L31", 2) + 0.35 + 0.22;
  const sealW = 70 * mix(1.5, 1, stamp); // the vector seal is 69 px across at this logo size
  const cta = P(t, chunk("L31", 3) - 0.05, 0.6, E.arrive);
  const credits = P(t, chunk("L31", 3) + 0.6, 0.6, E.arrive);

  const inS12 = t < L27.end + 0.9;
  const inS13 = t > L27.end + 0.3 && t < L30.end + 1;
  const inS14 = t > L30.end + 0.4;

  return (
    <AbsoluteFill style={{ background: C.inkDeep, overflow: "hidden" }}>
      {inS12 && (
        <AbsoluteFill style={{ transform: `translateY(${-up12 * 230}px) scale(${zs})`, filter: zb > 0.05 ? `blur(${zb}px)` : undefined, opacity: (1 - clamp(up12 * 3)) * clamp(zin * 3) }}>
          <div style={{ position: "absolute", left: 96, top: 100, fontFamily: MONO, fontSize: 19, color: C.mute, letterSpacing: "0.04em" }}>
            {swap < 0.5 ? "REAL CAPTURE · Avalanche Explorer (Fuji) · circle 0xc628…5Bfc" : "REAL CAPTURE · Avalanche Explorer (Fuji) · circle 0xa428…8f5a"}
          </div>
          <Browser url={swap < 0.5 ? "subnets-test.avax.network/c-chain/address/0xc628…5Bfc" : "subnets-test.avax.network/c-chain/address/0xa428…8f5a"}>
            <Img src={staticFile("capture/explorer-c628.png")} style={{ position: "absolute", left: 0, top: -scroll1, width: pageW, opacity: 1 - swap }} />
            <Img src={staticFile("capture/explorer-a428.png")} style={{ position: "absolute", left: 0, top: -170 - P(t, L27.start, 4.5, E.inOut) * 160, width: 1080, opacity: swap, transform: `translateY(${(1 - swap) * 8}px)` }} />
          </Browser>
          <div style={{ position: "absolute", left: 1240, top: 170, width: 620, display: "flex", flexDirection: "column", gap: 44, opacity: 1 - swap, transform: `translateY(${-swap * 20}px)` }}>
            <Stat t={t} at={chunk("L26", 1) - 0.1} n="5" label="contracts verified on Fuji" />
            <Stat t={t} at={chunk("L26", 1) + 0.6} n="634" label="Foundry tests · 17 invariants fuzzed" />
            <Stat t={t} at={chunk("L26", 2) + 0.2} n="0" label="critical or high in internal review" />
          </div>
          <div style={{ position: "absolute", left: 1240, top: 190, width: 620, display: "flex", flexDirection: "column", gap: 22, opacity: swap }}>
            <Words t={t} text="A full circle ran from the web on Nov 20." start={L27.start} size={52} color={C.ivory} align="left" />
            <div style={{ fontFamily: SANS, fontSize: 30, color: C.ivory, lineHeight: 1.35, opacity: P(t, L27.start + 0.6, 0.5) }}>The organizer signed in with Google, settled five rounds and closed the circle.</div>
            <div style={{ marginTop: 26 }}>
              <Stat t={t} at={chunk("L27", 1) - 0.05} n="0 USDC" label="left in the contract" size={110} />
            </div>
          </div>
        </AbsoluteFill>
      )}

      {inS13 && (
        <AbsoluteFill style={{ transform: `translateY(${-up13 * 230}px)`, opacity: 1 - clamp(up13 * 3) }}>
          {/* Q1 */}
          {(() => {
            const q = qPos(0);
            const a = P(t, chunk("L28", 1) - 0.05, 0.5);
            const arrive = P(t, q1 - 0.1, 0.6, E.arrive);
            return (
              <div style={{ position: "absolute", left: 150, right: 150, top: q.top + (1 - arrive) * 120, opacity: q.o * arrive }}>
                <Words t={t} text="Why on-chain?" start={q1 - 0.05} size={q.size} color={C.ivory} align="left" />
                <div style={{ marginTop: 18, fontFamily: SANS, fontSize: 38, color: C.ivory, lineHeight: 1.35, opacity: a * (1 - P(t, q2 - 0.2, 0.3)), filter: `blur(${(1 - a) * 8}px)` }}>Nobody holds the money. The rules can't change mid-circle.</div>
              </div>
            );
          })()}
          {/* Q2 */}
          {t > q2 - 0.3 && (() => {
            const q = qPos(1);
            const arrive = P(t, q2 - 0.1, 0.6, E.arrive);
            const fadeAns = 1 - P(t, q3 - 0.2, 0.3);
            const rows = [
              { at: chunk("L29", 1), body: "Transactions settle in about a second." },
              { at: chunk("L29", 2), body: "Native USDC with permit means one signature to join." },
              { at: chunk("L29", 3), body: "Fees are low enough for our relayer to pay them." },
            ];
            return (
              <div style={{ position: "absolute", left: 150, right: 150, top: q.top + (1 - arrive) * 120, opacity: q.o * arrive }}>
                <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
                  <Words t={t} text="Why Avalanche?" start={q2 - 0.05} size={q.size} color={C.ivory} align="left" />
                  <Img src={staticFile("brand/avalanche-ko.png")} style={{ height: q.size * 0.42, opacity: P(t, q2 + 0.3, 0.5) }} />
                </div>
                <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 20, opacity: fadeAns }}>
                  {rows.map((r, i) => {
                    const p = P(t, r.at - 0.05, 0.5);
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 22, opacity: p, filter: `blur(${(1 - p) * 8}px)`, transform: `translateY(${(1 - p) * 14}px)` }}>
                        <span style={{ width: 12, height: 12, borderRadius: 2, background: C.lime, flex: "none" }} />
                        <span style={{ fontFamily: SANS, fontSize: 38, color: C.ivory }}>{r.body}</span>
                        {i === 0 && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 14, marginLeft: 10 }}>
                            <span style={{ position: "relative", width: 220, height: 12, borderRadius: 6, background: "#2B2828", overflow: "hidden" }}>
                              <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${speed * 100}%`, background: C.lime }} />
                            </span>
                            <span style={{ fontFamily: MONO, fontSize: 24, color: speed >= 1 ? C.lime : C.mute }}>{speed >= 1 ? "~1 s" : `${(speed * 1.0).toFixed(1)} s`}</span>
                          </span>
                        )}
                      </div>
                    );
                  })}
                  <span style={{ fontFamily: MONO, fontSize: 18, color: C.mute, opacity: P(t, chunk("L29", 1) + 0.6, 0.5) }}>sub-second finality: figure published by Avalanche</span>
                </div>
              </div>
            );
          })()}
          {/* Q3 */}
          {t > q3 - 0.3 && (() => {
            const q = qPos(2);
            const arrive = P(t, q3 - 0.1, 0.6, E.arrive);
            const rows = [
              { at: chunk("L30", 1), body: "The money comes only from the members' own savings." },
              { at: chunk("L30", 2), body: "There is no token, nothing is minted, and no yield is promised." },
              { at: chunk("L30", 3), body: "The organizer's commission stays under Decree 19's interest cap.*" },
            ];
            return (
              <div style={{ position: "absolute", left: 150, right: 150, top: q.top + (1 - arrive) * 120, opacity: q.o * arrive }}>
                <Words t={t} text="Where does the money come from?" start={q3 - 0.05} size={q.size} color={C.ivory} align="left" />
                <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 20 }}>
                  {rows.map((r, i) => {
                    const p = P(t, r.at - 0.05, 0.5);
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 22, opacity: p, filter: `blur(${(1 - p) * 8}px)`, transform: `translateY(${(1 - p) * 14}px)` }}>
                        <span style={{ width: 12, height: 12, borderRadius: 2, background: C.lime, flex: "none" }} />
                        <span style={{ fontFamily: SANS, fontSize: 38, color: C.ivory }}>{r.body}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
          <div style={{ position: "absolute", left: 150, top: 840, fontFamily: MONO, fontSize: 18, color: C.mute, opacity: P(t, chunk("L30", 3) + 0.4, 0.5) }}>
            * commission-share mode (φ &gt; 0). The demo circles use a fixed 1% fee.
          </div>
        </AbsoluteFill>
      )}

      {inS14 && (
        <AbsoluteFill>
          {/* the closing line, then the brand: the end card is centred and does not drift */}
          <div style={{ position: "absolute", left: 0, right: 0, top: 360, transform: `translateY(${-lineOut * 230}px)`, opacity: 1 - clamp(lineOut * 3) }}>
            <Words t={t} text="The hụi you already know," start={L31.start - 0.05} size={92} color={C.ivory} />
            <div style={{ height: 18 }} />
            <Words t={t} text="with no one sitting on the pot." start={chunk("L31", 1) - 0.05} size={92} color={C.ivory} />
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 210, display: "flex", justifyContent: "center", alignItems: "center", gap: 36, opacity: logo, transform: `translateY(${(1 - logo) * 60}px)` }}>
            {/* Astra's 3D seal stamps down onto the mark, then hands over to the vector seal of the logo */}
            <div style={{ position: "relative" }}>
              <SealedEnvelope width={230} flap={1} sealFade={P(t, stampEnd + 0.04, 0.22)} />
              {stamp > 0 && t < stampEnd + 0.4 && (
                <div style={{ position: "absolute", left: 115 - sealW / 2, top: 79 - sealW / 2, width: sealW, opacity: clamp(stamp * 4) * (1 - P(t, stampEnd + 0.1, 0.22)) }}>
                  <Obj3D name="seal_only" width={sealW} />
                </div>
              )}
            </div>
            <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: 156, letterSpacing: "-0.05em", color: C.ivory, lineHeight: 1 }}>HụiSafe</div>
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 480, display: "flex", justifyContent: "center", alignItems: "center", gap: 44, opacity: cta, transform: `translateY(${(1 - cta) * 30}px)` }}>
            <div style={{ display: "inline-flex", alignItems: "center", minHeight: 82, padding: "0 40px", borderRadius: 4, background: C.lime, fontFamily: SANS, fontWeight: 700, fontSize: 38, color: C.ink }}>Try it on Fuji testnet</div>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <Img src={staticFile("brand/qr-app.png")} style={{ width: 150, height: 150, borderRadius: 8 }} />
              <div style={{ fontFamily: MONO, fontSize: 26, color: C.ivory, lineHeight: 1.4 }}>lamng.tail3abf4e.ts.net:8443</div>
            </div>
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 700, display: "flex", justifyContent: "center", alignItems: "center", gap: 28, opacity: credits }}>
            <span style={{ fontFamily: SANS, fontSize: 28, color: C.mute }}>Built on</span>
            <Img src={staticFile("brand/avalanche-ko.png")} style={{ height: 40 }} />
            <span style={{ width: 2, height: 40, background: "#3A3636" }} />
            <Img src={staticFile("brand/team1vietnam-white.png")} style={{ height: 34 }} />
            <span style={{ fontFamily: SANS, fontSize: 28, color: C.mute }}>UniHack 2026</span>
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 780, textAlign: "center", fontFamily: SANS, fontSize: 28, color: C.ivory, opacity: credits }}>
            Ngô Bình Minh (leader) · Ngô Lâm Tiến · Ngô Đặng Trọng Hiếu
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
