// Sound cue sheet for the mixer: every effect hangs off the same voiceover clock as the picture (src/plan.ts), with
// the same expressions the acts use for their beats (named after the act variable they mirror). Also writes where each
// voiceover line starts and the two music anchors. Run: `npx tsx scripts/cues.ts` -> audio/cues.json.
// If a beat moves in an act, move it here too (the earshot timeline check on the render catches a cue left behind).
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LINES, TOTAL, chunk, line } from "../src/plan.ts";

type Cue = { t: number; role: string; db?: number; label: string; pan?: number };
const cues: Cue[] = [];
// pan: -1 left .. 1 right, from where the event sits on screen (kept within +-0.5 so the voice stays the centre)
const add = (t: number, role: string, label: string, db = 0, pan = 0) => cues.push({ t: +t.toFixed(3), role, label, db, pan });
const run = (t0: number, n: number, gap: number, role: string, label: string, db = 0, pans: number[] = []) => {
  for (let i = 0; i < n; i++) add(t0 + i * gap, role, `${label} ${i + 1}/${n}`, db, pans[i] ?? 0);
};

const L = (id: string) => line(id);

// ---------- Act 1 (Act1.tsx) ----------
add(0.45, "whoosh.short", "S01 envelope drops in", -4);
add(0.98, "text", "S01 flap folds (closeP)");
add(1.06, "tock", "S01 seal stamps (stamp)");
add(L("L01").end + 0.25 + 0.35, "whoosh.short", "S01->S02 envelope recedes into the ring (toRing)", -4);
run(L("L01").end + 0.35 + 0.08 + 0.33, 4, 0.114, "pop", "S02 ring envelopes arrive (ringIn)", -4);
add(L("L02").start + 0.2, "land", "S02 the pot lands (jarIn)", -2);
run(L("L03").start + 0.15 + 0.55, 5, 0.09, "tick.crisp", "S02 round-1 coins into the pot (coinsIn1)", 0, [0, 0.35, 0.22, -0.22, -0.35]);
run(chunk("L03", 1) + 0.1 + 0.6, 2, 0.09, "tick.crisp", "S02 the pot to M1 (potToM1)", 2);
run(L("L04").start + 0.2 + 0.09 + 0.55, 4, 0.09, "tick.crisp", "S02 round-2 coins into the pot (coinsIn2)", -1, [0.35, 0.22, -0.22, -0.35]);
add(chunk("L04", 1) - 0.1 + 0.05, "pop", "S02 ORGANIZER tag (orgTag)");
add(L("L04").end + 0.15 + 0.01, "snap", "S02 the pot cracks (crack)");
add(L("L04").end + 0.42, "hit", "S02 the pot breaks (jar state 2); music M1 stops here");
add(L("L06").start + 0.08, "land", "S03 case 2 headline", -3);
add(L("L07").start + 0.08, "land", "S03 case 3 headline", -3);
add(L("L07").end + 0.2 + 0.35, "whoosh.short", "S03->S04 cases fold away (s3Out)", -2);
add(L("L08").start + 0.12, "pop", "S04 the two job cards", -3);
add(L("L09").start + 0.2 + 0.03, "text", "S04 job 1 struck through (strike)", 1);
add(L("L09").start + 0.45 + 0.02, "tock", "S04 seal stamps on job 2 (sealOn)", -1, 0.45);
add(L("L10").start + 0.12, "pop", "S04 five wallets arrive (wallets)", -2);
run(L("L10").start + 0.45 + 0.7, 5, 0.09, "tick.crisp", "S04 coins land in the wallets (coinsOut)", -1, [-0.45, -0.22, 0, 0.22, 0.45]);
const seam12 = L("L11").start - 0.3; // SEAM_1_2: the ivory flood fully covers the frame
// the eye reads the flood as done ~0.28 s before seam12 (earshot's cut detector: 42.18 s), so the sound lands there
const floodSeen = seam12 - 0.28;
add(floodSeen, "swell", "S04->S05 seal floods the frame ivory (flood); the music's beat drops here");
add(floodSeen, "drop", "S05 sub under the product reveal", -3);

// ---------- Act 2 (Act2.tsx) ----------
const L11 = L("L11"), L12 = L("L12"), L13 = L("L13"), L15 = L("L15"), L17 = L("L17"), L18 = L("L18");
const L19 = L("L19"), L20 = L("L20"), L21 = L("L21"), L22 = L("L22"), L23 = L("L23"), L24 = L("L24"), L25 = L("L25");
const s06 = L12.start - 0.45, s07 = L15.start - 0.55, s09 = L18.start - 0.5, s10 = L21.start - 0.45, s11 = L25.start - 0.4;
const cLanding = L11.start + 0.75, tGoogle = chunk("L11", 1) - 0.05;
const cMode = L12.start + 0.35, cN = chunk("L12", 1) - 0.15, cC = chunk("L12", 1) + 0.3, cBond = L13.start + 0.15, cDeposit = L13.start + 1.1;
const tJoin = L15.start + 1.2, tInput = chunk("L16", 1) + 0.1, tSeal = L17.start - 0.25;
const cSettle1 = L18.end + 0.45, cSettle2 = L22.start - 0.3, cChip = L25.end - 0.35;
const seam23 = L("L26").start - 0.42; // SEAM_2_3

add(seam12 + 0.42, "pop", "S05 status pill (hudIn)", -4);
add(cLanding, "click", "S05 click Chơi hụi ngay (cLanding)", 0, -0.3);
add(cLanding + 0.15 + 0.25, "whoosh.short", "S05 the phone slides in, camera follows (phIn)", -2, 0.35);
add(tGoogle, "land.light", "S05 tap Tiếp tục với Google (tGoogle)");
add(tGoogle + 0.38, "pop", "S05 wallet card (0 AVAX)");
add(s06 - 0.1 + 0.35, "whoosh.short", "S05->S06 phone drops, camera to the form (phDown)", -1, 0.3);
add(cMode, "click", "S06 Kiểu dây (cMode)", -2);
add(cN, "click", "S06 Số phần (cN)", -2);
add(cN + 0.12, "key", "S06 types 5");
add(cC, "click", "S06 Mức góp (cC)", -2);
run(cC + 0.12, 2, 0.1, "key", "S06 types 10 USDC");
add(cBond, "click", "S06 Ký quỹ (cBond)", -2);
add(cBond + 0.15, "key", "S06 types 4");
add(cBond + 0.35, "key", "S06 types 48");
add(cDeposit, "click", "S06 Nạp ký quỹ (cDeposit)", 1);
add(cDeposit + 0.15 + 0.2, "whoosh.short", "S06 coverage card slides in (coverIn)", 0, 0.3);
add(cDeposit + 0.35 + 1.65, "bell", "S06 coverage reaches 100% (pct)");
add(s07 + 0.05, "whoosh.short", "S06->S07 card out, phone back (coverOut, phBack)", -1);
add(tJoin, "land.light", "S07 tap Ký và vào dây (tJoin)");
add(tJoin + 0.27, "click.confirm", "S07 the fifth seat fills (joined)", 4);
add(tInput, "land.light", "S08 tap the bid field (tInput)", -2);
run(tInput + 0.12, 3, 0.12, "key", "S08 types 0,60 (bidVal)");
add(chunk("L16", 2) - 0.05 + 0.03, "pop", "S08 the cap line lights (capHi)", -4);
add(tSeal, "land.light", "S08 tap Niêm phong thăm (tSeal)");
add(tSeal + 0.02 + 0.22, "whoosh.short", "S08 the bid flies into the envelope (chip)", -6);
add(tSeal + 0.42, "text", "S08 the flap folds (close)");
add(L17.start + 0.28 + 0.02, "tock", "S08 the seal stamps (stamp)");
run(L17.end + 0.15 + 0.06, 2, 0.12, "pop", "S08 the two bids revealed (reveal)", -2);
add(s09 - 0.05 + 0.35, "whoosh.short", "S08->S09 envelope flies to the pill, desk opens (envFly)", -1);
add(cSettle1, "click", "S09 click Khui kỳ 1 (cSettle1)", 2);
add(cSettle1 + 0.27, "pop", "S09 toast: Kỳ 1 đã chốt", -2);
run(L19.start + 0.15 + 0.6, 4, 0.1, "tick.crisp", "S09 four shares into the pot (coinIn)", 1, [0.15, 0.2, 0.25, 0.3]);
add(chunk("L19", 1) + 0.1 + 0.33, "whoosh.short", "S09 the pot flies to Member 4's phone (coinOut)", -6, 0.35);
run(chunk("L19", 1) + 0.1 + 0.75, 2, 0.09, "tick.crisp", "S09 coins land on the phone", 2, [0.45, 0.45]);
add(chunk("L19", 1) + 0.8 + 1.6, "bell", "S09 28,848 USDC lands (payout1)");
add(L20.start - 0.2 + 0.05, "pop", "S09 breakdown rows (rows)", -4);
add(L20.start + 0.2 + 0.03, "tick", "S09 holdback row lights (hold)", -2);
add(s10 - 0.2 + 0.35, "whoosh.short", "S09->S10 phone out, camera to the desk (phOut); music edit hides here", -1, 0.35);
add(chunk("L21", 1), "drop", "S10 Member 4 comes up short (short)");
add(cSettle2, "click", "S10 click Khui kỳ 2 (cSettle2)", 1);
add(L22.start - 0.2 + 0.25, "whoosh.short", "S10 cascade card slides in", -5, 0.3);
add(chunk("L22", 1) - 0.05 + 0.03, "pop", "S10 8 from the holdback (fill1)", -1);
add(chunk("L22", 2) - 0.05 + 0.03, "pop", "S10 2 from the bond (fill2)", -1);
add(L23.start + 0.1 + 1.3, "bell", "S10 Member 1 gets the full 32,318 (payout2)");
add(L24.start + 0.2 + 0.03, "tock", "S10 VỠ NỢ tag stamped (tag)", -5);
run(chunk("L24", 1) - 0.2 + 0.6, 3, 0.6, "tick", "S10 rounds 3-5 fill on the pill (done)", -1);
add(s11 + 0.3, "whoosh.short", "S10->S11 to the ledger", -4);
run(s11 + 0.35 + 0.2, 5, 0.114, "pop", "S11 ledger rows (ledgerRows)", -6);
add(cChip, "click", "S11 click the transaction chip (cChip)");
add(seam23, "whoosh.long", "S11->S12 zoom-through into the explorer (zoom)");
add(seam23 + 0.05, "drop", "S12 sub as the explorer lands", -6);

// ---------- Act 3 (Act3.tsx) ----------
const L27 = L("L27"), L29 = L("L29"), L30 = L("L30");
add(chunk("L26", 1) - 0.1 + 0.05, "pop", "S12 stat 5 contracts", -1);
add(chunk("L26", 1) + 0.6 + 0.05, "pop", "S12 stat 634 tests", -1);
add(chunk("L26", 2) + 0.2 + 0.05, "pop", "S12 stat 0 critical or high", -1);
add(L27.start - 0.15 + 0.15, "whoosh.short", "S12 second capture (swap)", -7);
add(chunk("L27", 1) - 0.05 + 0.08, "bell", "S12 0 USDC left in the contract", -2);
add(L27.end + 0.25 + 0.3, "whoosh.short", "S12->S13 everything rises out (up12)", -2);
add(chunk("L28", 1) - 0.05, "pop", "S13 answer 1", -5);
add(L29.start - 0.1 + 0.2, "whoosh.short", "S13 question 2 arrives", -5);
[1, 2, 3].forEach((n) => add(chunk("L29", n), "tick", `S13 Avalanche reason ${n}`, -1));
add(L30.start - 0.1 + 0.2, "whoosh.short", "S13 question 3 arrives", -5);
[1, 2, 3].forEach((n) => add(chunk("L30", n), "tick", `S13 money reason ${n}`, -1));
add(L30.end + 0.25 + 0.33, "whoosh.short", "S13->S14 rises out (up13)", -2);
add(chunk("L31", 2) - 0.42 + 0.22, "whoosh.short", "S14 closing line out (lineOut), then the logo", -6);
add(chunk("L31", 2) + 0.35 + 0.02, "tock", "S14 the seal stamps on the logo (stamp)", 1);
add(chunk("L31", 2) + 0.35 + 0.02, "hit", "S14 weight under the logo stamp", -6);
add(chunk("L31", 2) + 0.35 + 0.02, "drop", "S14 sub under the end card", -4);
add(chunk("L31", 3) - 0.05 + 0.05, "pop", "S14 Try it on Fuji testnet", -3);

cues.sort((a, b) => a.t - b.t);

const out = {
  total: TOTAL,
  anchors: {
    shatter: +(L("L04").end + 0.42).toFixed(3), // music M1 stops on the break
    flood: +floodSeen.toFixed(3), // the music's beat drop (track 11.28 s) lands here
    edit: +(s10 - 0.2 + 0.07).toFixed(3), // the 10-bar music edit sits under the S10 whoosh
    logoStamp: +(chunk("L31", 2) + 0.37).toFixed(3),
  },
  vo: LINES.map((l) => ({ id: l.id, start: l.start, end: l.end })),
  cues,
};
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
writeFileSync(join(root, "audio/cues.json"), JSON.stringify(out, null, 1));
// earshot timeline --cues format: one entry per cue with its time and a label
writeFileSync(join(root, "audio/cues-earshot.json"), JSON.stringify({ fps: 60, events: cues.map((c) => ({ f: Math.round(c.t * 60), kind: c.role, id: c.label })) }, null, 1));
console.log(`${cues.length} cues, ${(cues.length / TOTAL * 10).toFixed(1)} per 10 s; anchors`, out.anchors);
