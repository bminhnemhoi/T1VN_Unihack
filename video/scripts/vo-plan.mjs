#!/usr/bin/env node
// Builds src/vo.generated.ts from script.md: one entry per voiceover line (L01..L31) with its caption chunks and duration.
// Duration source, in order: public/vo/timing.json (if it gives one), the MP3's real length (ffprobe), else an estimate.
// Run again whenever script.md or the VO files change: `node scripts/vo-plan.mjs`.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const md = readFileSync(join(root, "script.md"), "utf8");
const rows = md.split("\n").filter((l) => /^\| L\d\d /.test(l));

// timing.json: accept {"L01": 3.2} | {"L01": {"duration": 3.2}} | [{"id": "L01", "duration": 3.2}] | {"lines": [...]}
// (start/end pairs also accepted). Word timings, if present, are kept for later alignment.
function readTiming() {
  const p = join(root, "public/vo/timing.json");
  if (!existsSync(p)) return {};
  const raw = JSON.parse(readFileSync(p, "utf8"));
  const list = Array.isArray(raw) ? raw : Array.isArray(raw.lines) ? raw.lines : Object.entries(raw).map(([id, v]) => (typeof v === "number" ? { id, duration: v } : { id, ...v }));
  const out = {};
  for (const e of list) {
    const id = e.id ?? e.line ?? e.code;
    if (!id) continue;
    const d = e.duration ?? e.dur ?? (e.end !== undefined && e.start !== undefined ? e.end - e.start : undefined);
    out[id] = { duration: typeof d === "number" ? (d > 60 ? d / 1000 : d) : undefined, text: typeof e.text === "string" ? e.text : undefined };
  }
  return out;
}

function probe(file) {
  try {
    const s = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" });
    const d = parseFloat(s.trim());
    return Number.isFinite(d) ? d : undefined;
  } catch {
    return undefined;
  }
}

// Spoken-word estimate for Eric (~200 wpm without pauses), numbers expanded the way they are read.
function estimate(text) {
  const pauses2 = (text.match(/\/\//g) || []).length;
  const pauses1 = (text.match(/(^|[^/])\/(?!\/)/g) || []).length;
  const clean = text.replace(/\//g, " ");
  let words = 0;
  for (const w of clean.split(/\s+/).filter(Boolean)) {
    const t = w.replace(/[.,:;?!]+$/, "");
    if (/^\d+\.\d+$/.test(t)) words += t.replace(".", "").length + 1;
    else if (/^\d{4}$/.test(t)) words += 3;
    else if (/^\d{3}$/.test(t)) words += 4;
    else if (/^USDC$/.test(t)) words += 2;
    else words += 1;
  }
  return +(words / 3.3 + pauses1 * 0.28 + pauses2 * 0.65 + 0.2).toFixed(2);
}

// Chunk start times inside a line: the '/' marks in the script are where Eric pauses, so take the longest internal
// silences (ffmpeg silencedetect) as chunk boundaries; without audio, split by character count.
function alignChunks(file, chunks, dur) {
  const byChars = () => {
    const total = chunks.reduce((a, c) => a + c.length, 0);
    let acc = 0;
    return chunks.map((c) => { const t = (acc / total) * dur; acc += c.length; return +t.toFixed(3); });
  };
  if (!file) return { chunkStarts: byChars(), speechEnd: dur };
  const log = execFileSync("sh", ["-c", `ffmpeg -hide_banner -i "${file}" -af silencedetect=noise=-40dB:d=0.07 -f null - 2>&1 || true`], { encoding: "utf8" });
  const starts = [...log.matchAll(/silence_start: ([0-9.]+)/g)].map((m) => +m[1]);
  const ends = [...log.matchAll(/silence_end: ([0-9.]+)/g)].map((m) => +m[1]);
  const spans = starts.map((st, i) => ({ st, en: ends[i] ?? dur }));
  const tail = spans.find((sp) => sp.en >= dur - 0.02);
  const speechEnd = tail ? tail.st : dur;
  const inner = spans.filter((sp) => sp.st > 0.2 && sp.en < speechEnd - 0.1);
  const need = chunks.length - 1;
  if (need <= 0) return { chunkStarts: [0], speechEnd: +speechEnd.toFixed(3) };
  if (inner.length < need) return { chunkStarts: byChars(), speechEnd: +speechEnd.toFixed(3) };
  const picked = [...inner].sort((a, b) => b.en - b.st - (a.en - a.st)).slice(0, need).sort((a, b) => a.st - b.st);
  return { chunkStarts: [0, ...picked.map((sp) => +sp.en.toFixed(3))], speechEnd: +speechEnd.toFixed(3) };
}

const timing = readTiming();
const lines = rows.map((r) => {
  const c = r.split("|").map((x) => x.trim());
  const id = c[1];
  const scene = c[2];
  const raw = c[3];
  const chunks = raw.split(/\s*\/\/?\s*/).map((s) => s.trim()).filter(Boolean);
  const text = (timing[id]?.text ?? chunks.join(" ")).replace(/\s+/g, " ").trim();
  const mp3 = join(root, "public/vo", `${id}.mp3`);
  const hasAudio = existsSync(mp3);
  const fromTiming = timing[id]?.duration;
  const fromFile = hasAudio ? probe(mp3) : undefined;
  const dur = fromTiming ?? fromFile ?? estimate(raw);
  const source = fromTiming !== undefined ? "timing.json" : fromFile !== undefined ? "mp3" : "estimate";
  const { chunkStarts, speechEnd } = alignChunks(hasAudio ? mp3 : undefined, chunks, dur);
  return { id, scene, text, chunks, chunkStarts, speechEnd, dur: +dur.toFixed(3), hasAudio, source };
});

const header = "// Generated by scripts/vo-plan.mjs from script.md and public/vo. Do not edit by hand.\n";
const body = `export type VoLine = { id: string; scene: string; text: string; chunks: string[]; chunkStarts: number[]; speechEnd: number; dur: number; hasAudio: boolean; source: string };\nexport const VO: VoLine[] = ${JSON.stringify(lines, null, 2)};\n`;
writeFileSync(join(root, "src/vo.generated.ts"), header + body);
const total = lines.reduce((a, l) => a + l.dur, 0);
console.log(`lines ${lines.length}, VO total ${total.toFixed(1)} s, sources: ${[...new Set(lines.map((l) => l.source))].join(", ")}`);
