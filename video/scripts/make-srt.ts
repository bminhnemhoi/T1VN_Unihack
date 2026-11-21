// Writes out/HuiSafe-demo.srt from the same cues the film burns in. Run: node scripts/make-srt.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CUES } from "../src/captions.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ts = (s: number) => {
  const ms = Math.round(s * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const sec = Math.floor((ms % 60_000) / 1000);
  const r = ms % 1000;
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(h)}:${p(m)}:${p(sec)},${p(r, 3)}`;
};
const srt = CUES.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.rows.join("\n")}\n`).join("\n");
mkdirSync(join(root, "out"), { recursive: true });
writeFileSync(join(root, "out/HuiSafe-demo.srt"), srt);
const longest = Math.max(...CUES.flatMap((c) => c.rows.map((r) => r.length)));
console.log(`cues ${CUES.length}, max rows ${Math.max(...CUES.map((c) => c.rows.length))}, longest row ${longest} chars`);
