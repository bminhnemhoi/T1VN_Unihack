// The film's clock. Every beat in every scene is placed relative to a voiceover line from this file, so re-timing the
// film is a one-line change to GAP_BEFORE (seconds of air before a line) or END_HOLD. Pure module: no Remotion imports,
// so scripts/make-srt.ts can import it too.
import { VO, type VoLine } from "./vo.generated.ts";

export const FPS = 60;
export const WIDTH = 1920;
export const HEIGHT = 1080;

// Air before each line. 0.3-0.6 s inside a scene; longer only where the picture needs a beat (a click, a reveal, a flight).
const GAP_BEFORE: Record<string, number> = {
  L01: 1.0, // envelope drops and stamps before the declaration is read
  L02: 0.6, L03: 0.35, L04: 0.35,
  L05: 0.75, // the pot cracks; the red line carries into the first case
  L06: 0.45, L07: 0.45,
  L08: 0.7, L09: 0.45, L10: 0.4,
  L11: 0.9, // the seal floods the frame ivory: into the product
  L12: 0.6, L13: 0.4, L14: 0.5,
  L15: 0.7, L16: 0.6, L17: 0.3,
  L18: 1.4, // seal, reveal of the two bids, the envelope flies to the settle desk
  L19: 0.8, // stillness before the click lands
  L20: 0.4,
  L21: 0.7, L22: 0.7, L23: 0.4, L24: 0.5,
  L25: 0.6,
  L26: 0.9, // zoom-through into the explorer
  L27: 0.5,
  L28: 0.7, L29: 0.55, L30: 0.55,
  L31: 0.8,
};
export const END_HOLD = 2.8;

export type TimedLine = VoLine & { start: number; end: number };

export const LINES: TimedLine[] = (() => {
  let t = 0;
  return VO.map((l) => {
    const start = t + (GAP_BEFORE[l.id] ?? 0.4);
    const end = start + l.dur;
    t = end;
    return { ...l, start: +start.toFixed(3), end: +end.toFixed(3) };
  });
})();

export const TOTAL = +(LINES[LINES.length - 1].end + END_HOLD).toFixed(3);
export const TOTAL_FRAMES = Math.ceil(TOTAL * FPS);

const byId = Object.fromEntries(LINES.map((l) => [l.id, l])) as Record<string, TimedLine>;
export const line = (id: string): TimedLine => {
  const l = byId[id];
  if (!l) throw new Error(`unknown line ${id}`);
  return l;
};
// Start of chunk n (the script's "/" pieces) of a line, in film seconds.
export const chunk = (id: string, n: number): number => {
  const l = line(id);
  return l.start + (l.chunkStarts[n] ?? 0);
};

// Scene boundaries sit in the middle of the air between two scenes' lines.
const SCENES = ["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08", "S09", "S10", "S11", "S12", "S13", "S14"];
export const SCENE: Record<string, { start: number; end: number }> = (() => {
  const out: Record<string, { start: number; end: number }> = {};
  SCENES.forEach((s, i) => {
    const mine = LINES.filter((l) => l.scene === s);
    const prev = i > 0 ? LINES.filter((l) => l.scene === SCENES[i - 1]) : [];
    const next = i < SCENES.length - 1 ? LINES.filter((l) => l.scene === SCENES[i + 1]) : [];
    const start = i === 0 ? 0 : (prev[prev.length - 1].end + mine[0].start) / 2;
    const end = i === SCENES.length - 1 ? TOTAL : (mine[mine.length - 1].end + next[0].start) / 2;
    out[s] = { start: +start.toFixed(3), end: +end.toFixed(3) };
  });
  return out;
})();

// Acts: 1 = ink story (S01-S04), 2 = product on ivory (S05-S11), 3 = proof, questions, end (S12-S14).
export const ACT = {
  one: { start: 0, end: SCENE.S04.end },
  two: { start: SCENE.S05.start, end: SCENE.S11.end },
  three: { start: SCENE.S12.start, end: TOTAL },
};
