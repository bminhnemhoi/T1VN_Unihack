import React from "react";
import { AbsoluteFill } from "remotion";
import { C } from "../tokens";
import { MONO, SANS } from "../fonts";
import { E, P, Words, clamp, mix } from "../anim";
import { chunk, line } from "../plan";
import { Coin3D, Envelope3D, Jar3D, Obj3D } from "../objects";

// Act 1 on ink: the declaration, what hụi is, three sourced cases, the organizer's two jobs. Ends by flooding the
// frame ivory from the seal (shape morph into the product act).

const W = 1920;
const RING = { cx: 960, cy: 610, rx: 410, ry: 262 };
const ringPos = (i: number) => {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
  return { x: RING.cx + Math.cos(a) * RING.rx, y: RING.cy + Math.sin(a) * RING.ry };
};

export const SEAM_1_2 = () => line("L11").start - 0.3; // flood fully covers the frame here

export const Act1: React.FC<{ t: number }> = ({ t }) => {
  const L01 = line("L01"), L02 = line("L02"), L03 = line("L03"), L04 = line("L04");
  const L05 = line("L05"), L06 = line("L06"), L07 = line("L07");
  const L08 = line("L08"), L09 = line("L09"), L10 = line("L10");

  // ---- S01: envelope drops, flap folds, seal stamps; declaration line
  const drop = P(t, 0.15, 0.9, E.arrive);
  const closeP = P(t, 0.98, 0.14, E.linear);
  const stamp = P(t, 1.04, 0.24, E.outExpo);
  const toRing = P(t, L01.end + 0.25, 0.9, E.travel); // envelope recedes into the ring (pull back)
  const camPush = 1 + 0.03 * P(t, 0, L01.end, E.sine) + 0.035 * clamp((t - L01.end) / 36);
  const m1 = ringPos(0);
  const envW = mix(400, 180, toRing);
  const envX = mix(960, m1.x, toRing);
  const envY = mix(mix(180, 430, drop), m1.y - 15, toRing);
  const declIn = L01.start + 0.35;
  const declOut = P(t, L01.end + 0.15, 0.34, E.in4);

  // ---- S02: ring, pot, coins, organizer
  const ringIn = (i: number) => P(t, L01.end + 0.35 + i * 0.08, 0.8, E.arrive);
  const jarIn = P(t, L02.start, 0.6, E.arrive);
  const s2Out = P(t, L04.end + 0.45, 0.36, E.in4); // ring and pot leave left, the crack line carries on
  const crack = P(t, L04.end + 0.15, 0.25, E.outExpo);
  const potToM1 = P(t, chunk("L03", 1) + 0.1, 0.6, E.travel);
  const coinsIn1 = (i: number) => P(t, L03.start + 0.15 + i * 0.09, 0.55, E.travel);
  const coinsIn2 = (i: number) => P(t, L04.start + 0.2 + i * 0.09, 0.55, E.travel);
  const orgTag = P(t, chunk("L04", 1) - 0.1, 0.4, E.arrive);
  const s1Head = P(t, L02.start + 0.1, 0.5);
  const s1HeadOut = P(t, L04.start, 0.3, E.in4);
  const redLine = P(t, L04.end + 0.3, 0.55, E.travel);

  // ---- S03: three sourced cases
  const cases = [
    { at: L05.start, place: "Bình Thuận · 2024", big: "100+ billion VND", sub: "An organizer took it from 167 people.", src: "Báo Pháp luật, 20/09/2024" },
    { at: L06.start, place: "Trà Vinh · 2025", big: "157 fake shares", sub: "An organizer took 4+ billion VND and got 12 years in prison.", src: "VOV, 13/03/2025" },
    { at: L07.start, place: "Tây Ninh · 2026", big: "Fake Zalo accounts", sub: "An organizer used them to take nearly 500 million VND.", src: "VietnamPlus, 06/10/2026" },
  ];
  const s3Out = P(t, L07.end + 0.2, 0.45, E.in4);
  const s3Top = mix(mix(330, 200, P(t, L06.start - 0.1, 0.9, E.travel)), 110, P(t, L07.start - 0.1, 0.9, E.travel));
  const redArrive = L04.end + 0.85;

  // ---- S04: two jobs, wallets, bond, seal flood
  const head4 = L08.start;
  const split = P(t, L08.start + 0.1, 0.7, E.travel);
  const job1 = chunk("L08", 1), job2 = chunk("L08", 2);
  const kept = P(t, L09.start + 0.1, 0.35, E.inOut);
  const strike = P(t, L09.start + 0.2, 0.35, E.travel);
  const sealOn = P(t, L09.start + 0.45, 0.22, E.outExpo);
  const wallets = P(t, L10.start, 0.6, E.arrive);
  const coinsOut = (i: number) => P(t, L10.start + 0.45 + i * 0.08, 0.7, E.travel);
  const bondLine = chunk("L10", 1);
  const seam = SEAM_1_2();
  const squash = P(t, seam - 0.95, 0.15, E.inOut) * (1 - P(t, seam - 0.8, 0.12, E.linear));
  const flood = P(t, seam - 0.8, 0.8, E.inOut);

  const showS1 = t < L01.end + 1.4;
  const showS2 = t > L01.end && t < L05.start + 0.4;
  const showS3 = t > L04.end && t < L08.start + 1.2;
  const showS4 = t > L07.end;

  return (
    <AbsoluteFill style={{ background: C.inkDeep, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${camPush})` }}>
        {/* S01 declaration */}
        {showS1 && (
          <div style={{ position: "absolute", left: 0, right: 0, top: 700, display: "flex", justifyContent: "center", transform: `translateX(${-declOut * 230}px)`, opacity: 1 - clamp(declOut * 3.3) }}>
            <div style={{ display: "flex", alignItems: "center", gap: 24, padding: "20px 34px", borderRadius: 22, border: "1.5px solid #3A3636", opacity: P(t, declIn - 0.2, 0.4) }}>
              <span style={{ flex: "none", padding: "7px 12px", borderRadius: 4, background: C.lime, fontFamily: MONO, fontWeight: 600, fontSize: 20, letterSpacing: "0.06em", color: C.ink, opacity: P(t, declIn, 0.4) }}>DEMO · FUJI</span>
              <Words t={t} text="This demo runs on Avalanche Fuji testnet with test USDC. Each round is sped up to about two minutes." start={declIn + 0.15} size={32} color={C.ivory} weight={500} stagger={0.04} dur={0.45} lineHeight={1.25} align="left" maxWidth={900} />
            </div>
          </div>
        )}

        {/* S02 ring of members, pot and organizer */}
        {showS2 && (
          <AbsoluteFill style={{ transform: `translateX(${-s2Out * 230}px)`, opacity: 1 - clamp(s2Out * 3) }}>
            <div style={{ position: "absolute", left: 0, right: 0, top: 96, display: "flex", justifyContent: "center", opacity: s1Head * (1 - s1HeadOut), filter: `blur(${(1 - s1Head) * 10 + s1HeadOut * 10}px)`, transform: `translateY(${(1 - s1Head) * 24 - s1HeadOut * 30}px)` }}>
              <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: 150, letterSpacing: "-0.05em", color: C.ivory, lineHeight: 1 }}>Hụi</div>
            </div>
            <div style={{ position: "absolute", left: 0, right: 0, top: 96 }}>
              <Words t={t} text="One person holds the pot." start={L04.start + 0.25} size={96} color={C.ivory} />
            </div>
            {[1, 2, 3, 4].map((i) => {
              const p = ringPos(i);
              const k = ringIn(i);
              const from = { x: RING.cx + (p.x - RING.cx) * 3.2, y: RING.cy + (p.y - RING.cy) * 3.2 };
              return (
                <div key={i} style={{ position: "absolute", left: mix(from.x, p.x, k) - 90, top: mix(from.y, p.y, k) - 74, width: 180, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, opacity: clamp(k * 1.5) }}>
                  <Obj3D name="envelope_front" width={180} />
                  <span style={{ fontFamily: MONO, fontSize: 22, color: C.mute, opacity: P(t, L02.start, 0.4) }}>{`M${i + 1}`}</span>
                </div>
              );
            })}
            <div style={{ position: "absolute", left: m1.x - 90, top: m1.y - 74 + 180 * 0.597 + 10 + 3, width: 180, textAlign: "center", fontFamily: MONO, fontSize: 22, color: potToM1 > 0.5 && t < L04.start ? C.lime : C.mute, opacity: P(t, L02.start, 0.4) }}>M1</div>
            {/* coins of round 1 into the pot, then the pot to M1 */}
            {[0, 1, 2, 3, 4].map((i) => {
              const p = ringPos(i);
              const k = coinsIn1(i);
              const out = potToM1;
              if (k <= 0 || t > L04.start + 0.2) return null;
              const x = out > 0 ? mix(RING.cx, m1.x, out) : mix(p.x, RING.cx, k);
              const y = out > 0 ? mix(RING.cy - 20, m1.y + 30, out) - Math.sin(out * Math.PI) * 60 : mix(p.y, RING.cy - 20, k) - Math.sin(k * Math.PI) * 70;
              return <Coin3D key={i} size={54} x={x + (out > 0 ? (i - 2) * 7 : 0)} y={y} opacity={out >= 1 ? 0 : 1} tilt={(i - 2) * 8} spin={0.125 + i * 0.07 + (out > 0 ? 1 + out * 1.25 : k)} />;
            })}
            {/* round 2: four coins into the pot, the organizer holds it */}
            {[1, 2, 3, 4].map((i) => {
              const p = ringPos(i);
              const k = coinsIn2(i);
              if (k <= 0) return null;
              const x = mix(p.x, RING.cx, k);
              const y = mix(p.y, RING.cy - 20, k) - Math.sin(k * Math.PI) * 70;
              return <Coin3D key={`b${i}`} size={54} x={x} y={y} opacity={k >= 1 ? 0 : 1} tilt={(i - 2) * 8} spin={0.125 + i * 0.07 + k} />;
            })}
            <div style={{ position: "absolute", left: RING.cx - 135, top: RING.cy - 170, width: 270, opacity: jarIn, transform: `translateY(${(1 - jarIn) * 40}px)` }}>
              <Jar3D width={270} state={crack + P(t, L04.end + 0.42, 0.12, E.linear)} />
            </div>
            <div style={{ position: "absolute", left: 0, right: 0, top: RING.cy + 140, display: "flex", justifyContent: "center", opacity: orgTag, transform: `translateY(${(1 - orgTag) * 14}px)` }}>
              <span style={{ padding: "8px 16px", borderRadius: 4, border: `1.5px solid ${C.lime}`, fontFamily: MONO, fontWeight: 600, fontSize: 22, letterSpacing: "0.06em", color: C.lime }}>ORGANIZER</span>
            </div>
          </AbsoluteFill>
        )}

        {/* the envelope of S01 receding to become M1 */}
        {(showS1 || showS2) && (
          <div style={{ position: "absolute", left: envX - envW / 2, top: envY - (envW * 0.597) / 2, width: envW, opacity: 1 - clamp(s2Out * 3), transform: `translateX(${-s2Out * 230}px) rotate(${(1 - drop) * -5}deg)` }}>
            <Envelope3D width={envW} close={closeP} stamp={stamp} />
          </div>
        )}

        {/* the crack's red line, travelling left into the first case's underline */}
        {t > L04.end + 0.25 && t < redArrive + 0.05 && (
          <div style={{ position: "absolute", top: mix(RING.cy - 20, 330 + 104 * 1.04 - 10.4 - 14, redLine), left: mix(RING.cx - 4, 540, redLine), width: mix(8, 820, redLine), height: mix(8, 14, redLine), background: C.red, opacity: t < redArrive ? 1 : 0 }} />
        )}

        {/* S03 cases */}
        {showS3 && (
          <div style={{ position: "absolute", left: 190, right: 150, top: s3Top, transformOrigin: "50% 40%", transform: `scaleY(${1 - s3Out * 0.8})`, opacity: 1 - clamp(s3Out * 1.6) }}>
            {cases.map((c, i) => {
              const inP = P(t, c.at, 0.5, E.arrive);
              const next = cases[i + 1];
              const shrink = next ? P(t, next.at, 0.5, E.travel) : 0;
              const size = mix(104, 66, shrink);
              const active = shrink < 0.5;
              if (t < c.at - 0.05) return null;
              return (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "320px 1fr", alignItems: "baseline", columnGap: 30, paddingBottom: mix(26, 18, shrink), marginBottom: mix(30, 20, shrink), borderBottom: "1.5px dashed #3A3636", opacity: mix(1, 0.42, shrink) * inP }}>
                  <span style={{ fontFamily: MONO, fontSize: 24, color: C.mute }}>{c.place}</span>
                  <div>
                    <div style={{ position: "relative", display: "inline-block" }}>
                      <Words t={t} text={c.big} start={c.at + 0.05} size={size} color={C.ivory} align="left" stagger={0.06} />
                      {active && <div style={{ position: "absolute", left: 0, bottom: size * 0.1, height: 14, width: `${(i === 0 ? (t >= redArrive ? 1 : 0) : P(t, c.at + 0.15, 0.5, E.travel)) * 100}%`, background: C.red, opacity: 0.92 }} />}
                    </div>
                    <div style={{ marginTop: 10, fontFamily: SANS, fontSize: mix(36, 28, shrink), color: C.ivory, opacity: P(t, c.at + 0.45, 0.5) }}>{c.sub}</div>
                    <div style={{ marginTop: 8, fontFamily: MONO, fontSize: 18, color: C.mute, opacity: P(t, c.at + 0.7, 0.5) }}>{c.src}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* S04 two jobs */}
        {showS4 && (
          <AbsoluteFill>
            <div style={{ position: "absolute", left: 0, right: 0, top: 120 }}>
              <Words t={t} text="An organizer has two jobs." start={head4} size={84} color={C.ivory} />
            </div>
            {/* job 1: the organizer holds the money (dropped). Each line is struck on its own. */}
            {t < L10.start + 1.4 && (
              <div style={{ position: "absolute", left: mix(700, 300, split), top: 290, width: 560, height: 330, borderRadius: 22, border: "2px dashed #3A3636", boxSizing: "border-box", padding: "36px 40px", display: "flex", flexDirection: "column", justifyContent: "center", opacity: mix(1, 0.5, kept) * (1 - P(t, L10.start + 0.45, 0.6)) * P(t, L08.start, 0.4), transform: `rotate(${-3 * kept}deg) translateY(${-20 * kept}px)` }}>
                <span style={{ fontFamily: MONO, fontSize: 22, color: C.mute, opacity: P(t, L08.start + 0.6, 0.3) }}>Job 1</span>
                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                  {["The organizer holds", "the money."].map((ln, j) => (
                    <div key={j} style={{ position: "relative", display: "inline-block" }}>
                      <Words t={t} text={ln} start={job1 - 0.1 + j * 0.21} size={50} color={kept > 0.5 ? C.mute : C.ivory} align="left" />
                      <div style={{ position: "absolute", left: 0, top: "54%", height: 5, width: `${clamp(strike * 2 - j) * 100}%`, background: C.mute }} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* job 2: the organizer covers the loss (kept) */}
            <div style={{ position: "absolute", left: mix(700, 1060, split), top: 290, width: 560, height: 330, borderRadius: 22, background: kept > 0 ? `rgba(23,64,46,${kept})` : "transparent", border: `2px ${kept > 0.5 ? "solid" : "dashed"} ${kept > 0.5 ? C.forest : "#3A3636"}`, boxSizing: "border-box", padding: "36px 40px", display: "flex", flexDirection: "column", justifyContent: "center", opacity: P(t, L08.start, 0.4) }}>
              <span style={{ fontFamily: MONO, fontSize: 22, color: kept > 0.5 ? C.lime : C.mute, opacity: P(t, L08.start + 0.6, 0.3) }}>{kept > 0.5 ? "Job 2 · HụiSafe keeps it" : "Job 2"}</span>
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                <Words t={t} text="The organizer covers" start={job2 - 0.1} size={50} color={C.ivory} align="left" />
                <Words t={t} text="the loss." start={job2 + 0.11} size={50} color={C.ivory} align="left" />
              </div>
              <div style={{ marginTop: 16, opacity: P(t, bondLine, 0.5), filter: `blur(${(1 - P(t, bondLine, 0.5)) * 8}px)`, fontFamily: SANS, fontSize: 28, lineHeight: 1.3, color: C.ivory }}>The bond is locked in a smart contract.</div>
            </div>
            {/* five wallets: the money stays here */}
            <div style={{ position: "absolute", left: 0, right: 0, top: 700, display: "flex", justifyContent: "center", gap: 46, opacity: wallets, transform: `translateY(${(1 - wallets) * 40}px)` }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} style={{ width: 160, padding: "20px 0 14px", borderRadius: 14, background: "#201D1D", border: "1.5px solid #3A3636", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 48, height: 48, opacity: coinsOut(i - 1) >= 1 ? 1 : 0 }}><Obj3D name="coin_front" width={48} shadow={false} /></div>
                  <span style={{ fontFamily: MONO, fontSize: 20, color: C.mute }}>{`M${i} wallet`}</span>
                </div>
              ))}
            </div>
            {[0, 1, 2, 3, 4].map((i) => {
              const k = coinsOut(i);
              if (k <= 0 || k >= 1) return null;
              const fx = 580, fy = 450;
              const tx = 960 + (i - 2) * 206, ty = 742;
              // one and a half turns, so it lands face on and hands over to the coin resting in the wallet
              return <Coin3D key={i} size={54} x={mix(fx, tx, k)} y={mix(fy, ty, k) - Math.sin(k * Math.PI) * 90} tilt={(1 - k) * 30} spin={k * 1.5} />;
            })}
            {/* the seal: stamps on the kept job, then grows to flood the frame ivory */}
            {(() => {
              const cx = mix(1620, 960, flood), cy = mix(300, 540, flood);
              const r = mix(55, 1250, flood) * (1 - squash * 0.08);
              // lime to ivory as one continuous blend (a stepped swap read as a hard cut)
              const k = clamp((flood - 0.2) / 0.6);
              const ch = (i: number) => Math.round(mix(parseInt(C.lime.slice(i, i + 2), 16), parseInt(C.ivory.slice(i, i + 2), 16), k * k * (3 - 2 * k)));
              const col = `rgb(${ch(1)}, ${ch(3)}, ${ch(5)})`;
              const sw = 124 * mix(1.35, 1, sealOn) * (1 - squash * 0.08);
              return (
                <>
                  {flood > 0 && <div style={{ position: "absolute", left: cx - r, top: cy - r, width: r * 2, height: r * 2, borderRadius: "50%", background: col, zIndex: 30 }} />}
                  {sealOn > 0 && flood < 0.2 && (
                    <div style={{ position: "absolute", left: 1620 - sw / 2, top: 300 - sw / 2, opacity: sealOn * (1 - clamp(flood * 6)), zIndex: 31 }}>
                      <Obj3D name="seal_only" width={sw} />
                    </div>
                  )}
                </>
              );
            })()}
          </AbsoluteFill>
        )}
      </AbsoluteFill>
      {/* keep the ground clean behind the flood */}
      {flood > 0.995 && <AbsoluteFill style={{ background: C.ivory }} />}
    </AbsoluteFill>
  );
};

export const ACT1_WIDTH = W;
