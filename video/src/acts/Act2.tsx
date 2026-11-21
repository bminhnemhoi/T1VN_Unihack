import React from "react";
import { AbsoluteFill } from "remotion";
import { C, SHADOW_BUBBLE, SHADOW_WINDOW } from "../tokens";
import { MONO, SANS } from "../fonts";
import { Cursor, E, P, Tap, clamp, countTo, keys, mix, path, press } from "../anim";
import { chunk, line } from "../plan";
import { Coin3D, Envelope3D, Obj3D, SealedEnvelope } from "../objects";
import { BidRoom, CascadeCard, CoverageCard, CreateForm, InviteScreen, LandingCrop, Ledger, ResultCard, SeatsPanel, SettleDesk, SignIn, Toast, WaitSettle } from "../ui";
import { SEAM_1_2 } from "./Act1";

// Act 2 on ivory: one world (laptop window, phone, status pill) and one camera that travels between them.
// World coordinates are canvas pixels at scale 1. Every beat hangs off a voiceover line from plan.ts.

const LW = { x: 100, y: 150, w: 1180, h: 760 }; // laptop window
const PH = { x: 1340, y: 140, w: 430 }; // phone
const PH_H = PH.w * 2.06;

export const SEAM_2_3 = () => line("L26").start - 0.42; // zoom-through into the real capture lands here

// One page inside a frame: crossfade + 8 px rise, never a hard swap (stageshow motion.md, Recipes).
const Page: React.FC<{ t: number; from: number; to: number; children: React.ReactNode }> = ({ t, from, to, children }) => {
  const a = P(t, from + 0.1, 0.34, E.ui);
  const b = P(t, to, 0.14, E.linear);
  const o = a * (1 - b);
  if (o <= 0.001) return null;
  return <div style={{ position: "absolute", inset: 0, opacity: o, transform: `translateY(${(1 - a) * 8}px)` }}>{children}</div>;
};

const Window: React.FC<{ blur: number; children: React.ReactNode }> = ({ blur, children }) => (
  <div style={{ position: "absolute", left: LW.x, top: LW.y, width: LW.w, height: LW.h, borderRadius: 14, background: C.paper, boxShadow: `0 0 0 1px ${C.line}, ${SHADOW_WINDOW}`, overflow: "hidden", filter: blur > 0.05 ? `blur(${blur}px)` : undefined }}>
    <div style={{ height: 52, display: "flex", alignItems: "center", gap: 10, padding: "0 20px", borderBottom: `1px solid ${C.line}`, background: C.ivory }}>
      {[0, 1, 2].map((i) => <div key={i} style={{ width: 13, height: 13, borderRadius: "50%", background: C.line }} />)}
      <div style={{ marginLeft: 18, padding: "6px 18px", borderRadius: 999, background: C.paper, border: `1px solid ${C.line}`, fontFamily: MONO, fontSize: 17, color: C.ink2 }}>lamng.tail3abf4e.ts.net</div>
    </div>
    <div style={{ position: "relative", height: LW.h - 52 }}>{children}</div>
  </div>
);

const PhoneBody: React.FC<{ x: number; y: number; blur: number; children: React.ReactNode }> = ({ x, y, blur, children }) => (
  <div style={{ position: "absolute", left: x, top: y, width: PH.w, height: PH_H, borderRadius: PH.w * 0.15, background: "#0E0D0D", padding: PH.w * 0.03, boxSizing: "border-box", boxShadow: `inset 0 0 0 2px #3A3636, ${SHADOW_WINDOW}`, filter: blur > 0.05 ? `blur(${blur}px)` : undefined }}>
    <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: PH.w * 0.125, overflow: "hidden", background: C.ivory }}>
      <div style={{ position: "absolute", top: PH.w * 0.03, left: "50%", transform: "translateX(-50%)", width: PH.w * 0.3, height: PH.w * 0.085, borderRadius: 999, background: "#0E0D0D", zIndex: 5 }} />
      <div style={{ position: "absolute", top: PH.w * 0.045, left: PH.w * 0.09, fontFamily: SANS, fontWeight: 650, fontSize: PH.w * 0.042, color: C.ink, zIndex: 4 }}>9:41</div>
      {/* the screen starts under the status bar: the Page layers are absolutely positioned and ignore padding,
          so the box itself is offset (with padding they slid up under the notch and the clock) */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, top: PH.w * 0.15, overflow: "hidden" }}>{children}</div>
      <div style={{ position: "absolute", bottom: PH.w * 0.022, left: "50%", transform: "translateX(-50%)", width: PH.w * 0.34, height: 5, borderRadius: 3, background: C.ink, opacity: 0.85 }} />
    </div>
  </div>
);

// The status pill (HUD), top left, kept for the whole product act like the reference film's "Finding flights" pill.
const StatusHud: React.FC<{ o: number; text: string; sub: string; done: number; current: number; red?: number }> = ({ o, text, sub, done, current, red = -1 }) => (
  <div style={{ position: "absolute", left: 56, top: 44, display: "flex", alignItems: "center", gap: 18, padding: "14px 24px 14px 18px", borderRadius: 999, background: C.paper, boxShadow: `0 0 0 1px ${C.line}, ${SHADOW_BUBBLE}`, fontFamily: SANS, fontSize: 26, fontWeight: 650, color: C.ink, opacity: o, transform: `translateY(${(1 - o) * -30}px)`, zIndex: 70 }}>
    <SealedEnvelope width={46} />
    <span>{text}</span>
    <span style={{ color: C.ink2, fontWeight: 500 }}>{sub}</span>
    <div style={{ display: "flex", gap: 6 }}>
      {[0, 1, 2, 3, 4].map((i) => {
        const filled = clamp(done - i);
        const bg = i === red && filled > 0.5 ? C.red : filled > 0.5 ? C.ink : i === current ? C.lime : C.line;
        return <div key={i} style={{ width: 34, height: 8, borderRadius: 2, background: bg }} />;
      })}
    </div>
    <span style={{ padding: "5px 10px", borderRadius: 4, background: C.lime, fontFamily: MONO, fontWeight: 600, fontSize: 15, letterSpacing: "0.06em" }}>DEMO · FUJI</span>
  </div>
);

export const Act2: React.FC<{ t: number }> = ({ t }) => {
  const s0 = SEAM_1_2();
  const L11 = line("L11"), L12 = line("L12"), L13 = line("L13"), L14 = line("L14"), L15 = line("L15");
  const L16 = line("L16"), L17 = line("L17"), L18 = line("L18"), L19 = line("L19"), L20 = line("L20");
  const L21 = line("L21"), L22 = line("L22"), L23 = line("L23"), L24 = line("L24"), L25 = line("L25");
  const seamOut = SEAM_2_3();

  // ---------- scene windows ----------
  const s06 = L12.start - 0.45; // landing -> create form
  const s07 = L15.start - 0.55; // phone returns with the invite
  const s08 = L16.start - 0.4; // invite -> bid room
  const s09 = L18.start - 0.5; // device pair, settle desk
  const s10 = L21.start - 0.45; // desk round 2
  const s11 = L25.start - 0.4; // ledger

  // ---------- clicks ----------
  const cLanding = L11.start + 0.75;
  const tGoogle = chunk("L11", 1) - 0.05;
  const cMode = L12.start + 0.35;
  const cN = chunk("L12", 1) - 0.15;
  const cC = chunk("L12", 1) + 0.3;
  const cBond = L13.start + 0.15;
  const cDeposit = L13.start + 1.1;
  const tJoin = L15.start + 1.2;
  const tInput = chunk("L16", 1) + 0.1;
  const tSeal = L17.start - 0.25;
  const cSettle1 = L18.end + 0.45;
  const cSettle2 = L22.start - 0.3;
  const cChip = L25.end - 0.35;

  // ---------- values ----------
  const hold = P(t, cDeposit + 0.35, 0.45, E.inOut);
  const bond = P(t, cDeposit + 0.8, 1.2, E.inOut);
  const pct = countTo(t, cDeposit + 0.35, 1.65, 0, 100);
  const typed48 = t < cBond + 0.15 ? "" : t < cBond + 0.35 ? "4" : "48";
  const coverIn = P(t, cDeposit + 0.15, 0.7, E.arrive);
  const coverOut = P(t, s07 - 0.4, 0.45, E.in4);
  const joined = 4 + P(t, tJoin + 0.25, 0.4, E.arrive);
  const bidVal = t < tInput ? "" : t < tInput + 0.12 ? "0" : t < tInput + 0.24 ? "0," : t < tInput + 0.36 ? "0,6" : "0,60";
  const capHi = P(t, chunk("L16", 2) - 0.05, 0.3, E.ui) * (1 - P(t, L17.start + 0.4, 0.3));
  const sealP = P(t, tSeal + 0.05, 0.2);
  const settled1 = P(t, cSettle1 + 0.1, 0.2);
  const payout1 = countTo(t, chunk("L19", 1) + 0.8, 1.6, 0, 28.848);
  const settled2 = P(t, cSettle2 + 0.1, 0.2);
  const fill1 = P(t, chunk("L22", 1) - 0.05, 0.55, E.travel);
  const fill2 = P(t, chunk("L22", 2) - 0.05, 0.45, E.travel);
  const payout2 = countTo(t, L23.start + 0.1, 1.3, 0, 32.318);
  const chartP = P(t, L24.start + 0.1, 0.1, E.linear) * 0.2 + P(t, chunk("L24", 1) - 0.35, 1.6, E.inOut) * 0.8;
  const bondNow = mix(48, 16, P(t, chunk("L24", 1) - 0.35, 1.6, E.inOut));
  const ledgerRows = [0, 1, 2, 3, 4].map((i) => P(t, s11 + 0.35 + i * 0.09, 0.45, E.arrive));

  // ---------- camera: [t, cx, cy, s] (world point at screen centre, scale) ----------
  const cam: [number, number, number, number][] = [
    [s0, 980, 560, 0.97],
    [cLanding + 0.25, 990, 556, 1.0],
    // to the phone as it arrives, and hold on it while the wallet line is read: the phone stays whole left and right
    // (its empty lower part runs off the bottom on purpose), so no pan cuts it while it is the subject
    [tGoogle + 0.25, 1555, 492, 1.33],
    [L11.end, 1555, 490, 1.37],
    [s06 + 0.7, 760, 545, 1.02],
    [cDeposit + 0.2, 820, 548, 1.03],
    [cDeposit + 1.0, 1230, 535, 1.38],
    [L13.end, 1240, 530, 1.46],
    [L14.end, 1240, 530, 1.5],
    [s07 + 0.9, 1400, 520, 1.2],
    // S07-S08 close-ups keep the phone's lowest line (wallet balance, seal button) above the caption band
    [L15.start + 2.2, 1400, 500, 1.3],
    [L15.end, 1400, 498, 1.32],
    [s08 + 0.7, 1330, 540, 1.12],
    [chunk("L16", 1) + 0.4, 1400, 530, 1.2],
    [chunk("L16", 2) + 0.4, 1400, 532, 1.22],
    [L17.start, 1360, 548, 1.16],
    [s09 + 0.6, 960, 560, 0.98],
    [cSettle1 + 0.3, 960, 560, 0.99],
    [chunk("L19", 2) - 0.2, 1556, 438, 2.0],
    [L20.start + 0.5, 1556, 560, 1.7],
    [L20.end, 1556, 566, 1.74],
    [s10 + 0.7, 660, 560, 1.18],
    [chunk("L21", 1) + 0.6, 660, 580, 1.3],
    [L22.start + 0.6, 1300, 400, 1.45],
    [L22.end, 1300, 404, 1.48],
    [L23.start + 0.7, 1300, 640, 2.05],
    [L23.end, 1300, 640, 2.08],
    [chunk("L24", 1) - 0.4, 1300, 815, 1.9],
    [L24.end + 0.2, 1300, 815, 1.95],
    [s11 + 0.6, 690, 540, 1.06],
    [cChip - 0.1, 1050, 560, 1.18],
  ];
  const cx = keys(t, cam.map(([a, x]) => [a, x] as [number, number]));
  const cy = keys(t, cam.map(([a, , y]) => [a, y] as [number, number]));
  let s = keys(t, cam.map(([a, , , k]) => [a, k] as [number, number]));
  // zoom-through into the transaction chip (push, growing): exit accelerates, Act 3 picks it up mid-flight
  const zoom = P(t, seamOut - 0.42, 0.42, E.in4);
  s *= 1 + zoom * 5;
  const zcx = mix(cx, 1123, zoom), zcy = mix(cy, 592, zoom);
  const toScreen = (wx: number, wy: number) => ({ x: 960 + (wx - zcx) * s, y: 540 + (wy - zcy) * s });
  const tilt = mix(-4, 2, clamp((t - s0) / (seamOut - s0)));

  // depth of field: whatever the camera is not looking at goes soft
  const lwBlur = keys(t, [[tGoogle - 0.2, 0], [tGoogle + 0.35, 6], [L11.end, 6], [s06 + 0.45, 0], [s07 - 0.2, 0], [s07 + 0.7, 6], [s09 + 0.1, 6], [s09 + 0.7, 0], [chunk("L19", 1), 0], [chunk("L19", 1) + 0.6, 6], [L20.end, 6], [s10 + 0.3, 0]], E.inOut);
  const phBlur = 0;

  // ---------- phone position: in for S05, away for S06, back S07-S09, away S10+ ----------
  const phIn = P(t, cLanding + 0.15, 0.75, E.arrive);
  const phDown = P(t, s06 - 0.1, 0.55, E.in4);
  const phBack = P(t, s07 + 0.05, 0.8, E.arrive);
  const phOut = P(t, s10 - 0.2, 0.6, E.in4);
  const phX = PH.x + (1 - phIn) * 700 + phOut * 760;
  const phoneShown = t < s06 + 0.6 || t > s07 - 0.1;
  const phYfinal = t < s07 ? PH.y + phDown * 1100 : PH.y + (1 - phBack) * 1100;

  // ---------- coins of round 1: from the four payers' rows to the pot, then to Member 4's phone ----------
  const rowY = [386, 462, 538, 614];
  const pot = { x: 1240, y: 470 };
  const coinIn = (i: number) => P(t, L19.start + 0.15 + i * 0.1, 0.6, E.travel);
  const coinOut = P(t, chunk("L19", 1) + 0.1, 0.75, E.travel);

  // ---------- cursor (screen space, projected from world targets) ----------
  const cursorKeys: [number, number, number][] = [];
  const W = (wx: number, wy: number) => toScreen(wx, wy);
  const addLeg = (tt: number, wx: number, wy: number) => cursorKeys.push([tt, wx, wy]);
  addLeg(L11.start - 0.4, 420, 1300);
  addLeg(cLanding - 0.1, 412, 630);
  addLeg(cLanding + 0.6, 412, 630);
  addLeg(cLanding + 1.4, 300, 1300);
  addLeg(s06 + 0.3, 520, 1300);
  addLeg(cMode - 0.05, 640, 408);
  addLeg(cN - 0.05, 640, 502);
  addLeg(cC - 0.05, 640, 596);
  addLeg(cBond - 0.05, 640, 690);
  addLeg(cDeposit - 0.05, 240, 782);
  addLeg(cDeposit + 0.7, 150, 900);
  addLeg(cDeposit + 1.6, 120, 1300);
  addLeg(s09, 520, 1400);
  addLeg(L18.start + 0.2, 560, 1300);
  addLeg(L18.end - 0.1, 330, 700);
  addLeg(cSettle1 + 0.5, 330, 700);
  addLeg(cSettle1 + 1.4, 380, 1300);
  addLeg(L21.end - 0.8, 400, 1350);
  addLeg(cSettle2 - 0.1, 330, 762);
  addLeg(cSettle2 + 0.6, 330, 762);
  addLeg(cSettle2 + 1.5, 420, 1350);
  addLeg(L25.start + 0.4, 900, 1300);
  addLeg(cChip - 0.1, 1140, 604);
  addLeg(seamOut, 1140, 604);
  const cw = path(t, cursorKeys);
  const cs = W(cw.x, cw.y);
  const curPress = Math.max(press(t, cLanding), press(t, cMode), press(t, cN), press(t, cC), press(t, cBond), press(t, cDeposit), press(t, cSettle1), press(t, cSettle2), press(t, cChip));
  const cursorOn = (t > L11.start - 0.4 && t < cLanding + 1.4) || (t > s06 + 0.3 && t < cDeposit + 1.6) || (t > s09 && t < cSettle1 + 1.4) || (t > L21.end - 0.8 && t < cSettle2 + 1.5) || (t > L25.start + 0.4);

  // ---------- HUD ----------
  const hudIn = P(t, s0 + 0.35, 0.6, E.arrive);
  let hudText = "HụiSafe", hudSub = "Fuji testnet", done = 0, current = -1, red = -1;
  if (t > chunk("L12", 1)) { hudText = "5 members · 10 USDC"; hudSub = "Forming"; }
  if (t > s07) hudSub = joined >= 4.99 ? "5/5 joined" : "4/5 joined";
  if (t > L15.end - 0.6) { hudSub = "Round 1/5"; current = 0; }
  if (t > s08) { hudText = "0xc628…5Bfc"; }
  if (t > cSettle1 + 0.2) { done = 1; current = 1; hudSub = "Round 2/5"; }
  if (t > cSettle2 + 0.2) { done = 2; current = 2; red = 1; hudSub = "Round 3/5"; }
  if (t > chunk("L24", 1) - 0.2) {
    const k = 2 + P(t, chunk("L24", 1) - 0.2, 1.8, E.linear) * 3;
    done = k; current = Math.min(4, Math.floor(k)); red = 1;
    hudSub = k >= 4.99 ? "Completed" : `Round ${Math.min(5, Math.floor(k) + 1)}/5`;
  }

  const envIn = P(t, tSeal - 0.1, 0.45, E.arrive);
  const chip = P(t, tSeal + 0.02, 0.45, E.travel);
  const reveal = P(t, L17.end + 0.15, 0.5, E.arrive);
  const envFly = P(t, s09 - 0.05, 0.75, E.travel);
  const envX = mix(1090, 640, envFly), envY = mix(470, 340, envFly), envW = mix(330, 70, envFly);

  return (
    <AbsoluteFill style={{ background: C.ivory, overflow: "hidden" }}>
      <AbsoluteFill style={{ perspective: 2600 }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, transformOrigin: `${zcx}px ${zcy}px`, transform: `translate(${960 - zcx}px, ${540 - zcy}px) scale(${s}) rotateX(2deg) rotateY(${tilt}deg)`, filter: zoom > 0.01 ? `blur(${zoom * 18}px)` : undefined, opacity: 1 - clamp((zoom - 0.6) * 2.5) }}>
          <div style={{ transform: `scale(${mix(0.93, 1, P(t, s0, 0.6, E.arrive))})`, opacity: P(t, s0 - 0.05, 0.35, E.linear), transformOrigin: "640px 520px", position: "absolute", inset: 0 }}>
            <Window blur={lwBlur}>
              <Page t={t} from={s0} to={s06}><LandingCrop press={press(t, cLanding)} /></Page>
              <Page t={t} from={s06} to={s07}>
                <CreateForm mode={t > cMode + 0.1 ? "Bỏ thăm" : ""} n={t > cN + 0.12 ? "5" : ""} c={t > cC + 0.12 ? "10 USDC" : ""} bond={typed48 ? `${typed48} USDC` : ""} focus={t < cN ? 0 : t < cC ? 1 : t < cBond ? 2 : 3} caret={t > cMode && t < cDeposit && Math.floor(t * 2.4) % 2 === 0} press={press(t, cDeposit)} ready={P(t, cDeposit + 1.9, 0.3)} />
              </Page>
              <Page t={t} from={s07} to={s09}><SeatsPanel joined={joined} /></Page>
              <Page t={t} from={s09} to={s10}>
                <SettleDesk k={1} press={press(t, cSettle1)} short={0} tag={0} settled={settled1} />
                <div style={{ position: "absolute", right: 36, top: 26, display: "flex", justifyContent: "flex-end" }}>
                  <Toast text="Kỳ 1 đã chốt · Thành viên 4 nhận 28,848 USDC" o={P(t, cSettle1 + 0.25, 0.4, E.arrive)} />
                </div>
              </Page>
              <Page t={t} from={s10} to={s11}>
                <SettleDesk k={2} press={press(t, cSettle2)} short={P(t, chunk("L21", 1), 0.25, E.ui)} tag={P(t, L24.start + 0.2, 0.3)} settled={settled2} />
              </Page>
              <Page t={t} from={s11} to={seamOut + 1}><Ledger rows={ledgerRows} hot={P(t, cChip, 0.1)} /></Page>
            </Window>

            {/* coverage card (S06), straddling the window's right edge */}
            {t > cDeposit && t < s07 + 0.6 && (
              <div style={{ position: "absolute", left: 920 + (1 - coverIn) * 260 + coverOut * 300, top: 240, opacity: coverIn * (1 - coverOut) }}>
                <CoverageCard hold={hold} bond={bond} pct={pct} />
              </div>
            )}

            {/* cascade card (S10) */}
            {t > L22.start - 0.2 && t < s11 + 0.6 && (
              <div style={{ position: "absolute", left: 890 + (1 - P(t, L22.start - 0.2, 0.7, E.arrive)) * 260 + P(t, s11 - 0.1, 0.45, E.in4) * 300, top: 120, opacity: P(t, L22.start - 0.2, 0.5) * (1 - P(t, s11 - 0.1, 0.45)) }}>
                <CascadeCard fill1={fill1} fill2={fill2} payout={payout2} payoutOn={P(t, L23.start - 0.1, 0.35)} chart={chartP} bondNow={bondNow} />
              </div>
            )}

            {/* phone */}
            {phoneShown && (
              <PhoneBody x={phX} y={phYfinal} blur={phBlur}>
                <Page t={t} from={s0} to={s06 + 0.3}><SignIn wallet={P(t, tGoogle + 0.35, 0.5, E.arrive)} googlePress={press(t, tGoogle)} tap={<Tap t={t} at={tGoogle} x={0} y={0} />} /></Page>
                <Page t={t} from={s07 - 0.2} to={s08}><InviteScreen press={press(t, tJoin)} joined={P(t, tJoin + 0.2, 0.2)} glow={P(t, L15.start + 0.6, 0.3)} tap={<Tap t={t} at={tJoin} x={0} y={0} />} /></Page>
                <Page t={t} from={s08} to={s09}><BidRoom value={bidVal} caret={t > tInput - 0.3 && t < tSeal && Math.floor(t * 2.4) % 2 === 0} cap={capHi} seal={sealP} clock={`00:${String(Math.max(0, 75 - Math.floor((t - s08) * 2))).padStart(2, "0")}`} tapInput={<Tap t={t} at={tInput} x={0} y={0} />} tapSeal={<Tap t={t} at={tSeal} x={0} y={0} />} /></Page>
                <Page t={t} from={s09} to={chunk("L19", 1) + 0.6}><WaitSettle /></Page>
                <Page t={t} from={chunk("L19", 1) + 0.6} to={s10 + 1}><ResultCard payout={payout1} rows={P(t, L20.start - 0.2, 0.4)} hold={P(t, L20.start + 0.2, 0.35, E.ui)} /></Page>
              </PhoneBody>
            )}

            {/* the sealed bid: the amount flies from the phone into the envelope, the seal stamps */}
            {t > tSeal - 0.15 && t < s09 + 0.85 && (
              <>
                <div style={{ position: "absolute", left: envX - envW / 2, top: envY - (envW * 0.597) / 2, width: envW, opacity: envIn * (1 - P(t, s09 + 0.55, 0.25)), transform: `scale(${mix(0.85, 1, envIn)})` }}>
                  <Envelope3D width={envW} close={P(t, tSeal + 0.42, 0.14, E.linear)} stamp={P(t, L17.start + 0.28, 0.24, E.outExpo)} />
                  <div style={{ position: "absolute", left: 0, right: 0, top: envW * 0.64, textAlign: "center", fontFamily: MONO, fontSize: 22 * (envW / 330), color: C.ink2, opacity: P(t, L17.start + 0.5, 0.4) * (1 - envFly) }}>keccak256 → 0x8f3a…c21e</div>
                  <div style={{ position: "absolute", left: 0, right: 0, top: -54 * (envW / 330), display: "flex", justifyContent: "center", opacity: reveal * (1 - envFly) }}>
                    <span style={{ padding: "6px 12px", borderRadius: 4, background: C.ink, color: C.lime, fontFamily: MONO, fontWeight: 600, fontSize: 20 }}>Thành viên 4 · 0,60 · thắng</span>
                  </div>
                </div>
                {chip > 0 && chip < 1 && (
                  <div style={{ position: "absolute", left: mix(PH.x + 80, 1060, chip), top: mix(PH.y + 450, 450, chip) - Math.sin(chip * Math.PI) * 60, padding: "6px 12px", borderRadius: 6, background: C.paper, border: `1.5px solid ${C.ink}`, fontFamily: MONO, fontSize: 28, opacity: 1 - clamp((chip - 0.8) * 5) }}>0,60</div>
                )}
                <div style={{ position: "absolute", left: 760 - 120, top: 470 - 77 + (1 - reveal) * 30, width: 240, opacity: reveal * (1 - P(t, s09 - 0.1, 0.3)) }}>
                  <Obj3D name="envelope_34_left" width={240} />
                  <div style={{ position: "absolute", left: 0, right: 0, top: -46, display: "flex", justifyContent: "center" }}>
                    <span style={{ padding: "6px 12px", borderRadius: 4, background: C.paper, border: `1.5px solid ${C.line}`, fontFamily: MONO, fontSize: 18 }}>Thành viên 2 · 0,40</span>
                  </div>
                </div>
              </>
            )}

            {/* coins: four payers into the pot, the pot to Member 4's phone */}
            {t > L19.start && t < chunk("L19", 1) + 1.0 && [0, 1, 2, 3].map((i) => {
              const k = coinIn(i);
              if (k <= 0) return null;
              const sx = 1030, sy = rowY[i];
              const x = coinOut > 0 ? mix(pot.x, PH.x + 215, coinOut) : mix(sx, pot.x, k);
              const y = coinOut > 0 ? mix(pot.y, PH.y + 330, coinOut) - Math.sin(coinOut * Math.PI) * 80 : mix(sy, pot.y, k) - Math.sin(k * Math.PI) * 50;
              return <Coin3D key={i} size={52} x={x + (coinOut > 0 ? (i - 1.5) * 8 : 0)} y={y} opacity={coinOut >= 1 ? 0 : 1} tilt={(i - 1.5) * 10} spin={0.125 + i * 0.07 + (coinOut > 0 ? 1 + coinOut * 1.25 : k)} />;
            })}
          </div>
        </div>
      </AbsoluteFill>

      <StatusHud o={hudIn * (1 - zoom)} text={hudText} sub={hudSub} done={done} current={current} red={red} />
      {cursorOn && zoom < 0.5 && <Cursor x={cs.x} y={cs.y} press={curPress} opacity={1 - clamp(zoom * 3)} />}
    </AbsoluteFill>
  );
};
