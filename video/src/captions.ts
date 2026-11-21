// Subtitle cues from the voiceover text (timing.json "text", never "spoken"). Each line is split at punctuation into
// pieces of at most 2 rows x 42 characters; time is shared out by character count, and each inner boundary snaps to
// the nearest real pause in the audio (within 0.35 s) so a cue changes when Eric breathes. Pure: no Remotion imports.
import { LINES, type TimedLine } from "./plan.ts";

export const MAX_COLS = 42;
const SOFT = 64; // prefer cues no longer than this; hard limit is 2 rows

export type Cue = { id: string; start: number; end: number; rows: string[] };

export function wrap(text: string, cols = MAX_COLS): string[] {
  const rows: string[] = [];
  let cur = "";
  for (const w of text.split(" ")) {
    if (!cur) cur = w;
    else if ((cur + " " + w).length <= cols) cur += " " + w;
    else {
      rows.push(cur);
      cur = w;
    }
  }
  if (cur) rows.push(cur);
  return rows;
}

// Balanced two-row wrap: move words down until the rows are as even as they can be (reads calmer than greedy).
function balance(text: string): string[] {
  const words = text.split(" ");
  if (text.length <= MAX_COLS) return [text];
  let best: string[] | null = null;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    if (a.length > MAX_COLS || b.length > MAX_COLS) continue;
    const d = Math.abs(a.length - b.length);
    if (d < bestDiff) {
      bestDiff = d;
      best = [a, b];
    }
  }
  return best ?? wrap(text);
}

// Split after , . : ; ? ! when followed by a space (keeps 28.848 and 0.65 whole).
const phrases = (text: string) => text.split(/(?<=[,.:;?!])\s+/).filter(Boolean);

function piecesOf(text: string): string[] {
  const out: string[] = [];
  let cur = "";
  for (const ph of phrases(text)) {
    const next = cur ? cur + " " + ph : ph;
    if (!cur) cur = ph;
    else if (next.length <= SOFT && balance(next).length <= 2) cur = next;
    else {
      out.push(cur);
      cur = ph;
    }
  }
  if (cur) out.push(cur);
  // A single phrase longer than two rows: split it at a word boundary.
  return out.flatMap((p) => {
    if (balance(p).length <= 2) return [p];
    const rows = wrap(p);
    const res: string[] = [];
    for (let i = 0; i < rows.length; i += 2) res.push(rows.slice(i, i + 2).join(" "));
    return res;
  });
}

export function cuesFor(l: TimedLine): Cue[] {
  const pieces = piecesOf(l.text);
  const spoken = l.speechEnd > 0.2 ? l.speechEnd : l.dur;
  const total = pieces.reduce((a, p) => a + p.length, 0);
  const pauses = l.chunkStarts.slice(1);
  let acc = 0;
  const bounds = pieces.map((p) => {
    const t = (acc / total) * spoken;
    acc += p.length;
    return t;
  });
  const snapped = bounds.map((b, i) => {
    if (i === 0) return 0;
    const near = pauses.reduce((best, s) => (Math.abs(s - b) < Math.abs(best - b) ? s : best), Infinity);
    return Math.abs(near - b) <= 0.35 ? near : b;
  });
  return pieces.map((p, i) => ({
    id: `${l.id}.${i + 1}`,
    start: +(l.start + snapped[i]).toFixed(3),
    end: +(i + 1 < pieces.length ? l.start + snapped[i + 1] : l.start + spoken + 0.25).toFixed(3),
    rows: balance(p),
  }));
}

export const CUES: Cue[] = (() => {
  const all = LINES.flatMap(cuesFor);
  // A cue never runs into the next line's first cue.
  for (let i = 0; i < all.length - 1; i++) all[i].end = Math.min(all[i].end, all[i + 1].start - 0.02);
  return all;
})();
