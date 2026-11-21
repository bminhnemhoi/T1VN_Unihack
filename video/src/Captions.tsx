import React from "react";
import { C } from "./tokens";
import { SANS } from "./fonts";
import { P, E } from "./anim";
import { CUES } from "./captions";

// Burned-in English subtitles: an overlay on top of the film (captions-overlay), never a reserved band.
// Inter Tight 35 px, at most 2 rows of 42 characters, dark pill 72%, 64 px from the bottom.
// Lines whose words are already on screen as the end card (L31) are not repeated here.
const HIDE = new Set(["L31"]);

export const Captions: React.FC<{ t: number }> = ({ t }) => {
  const cue = CUES.find((c) => t >= c.start - 0.06 && t < c.end + 0.12 && !HIDE.has(c.id.split(".")[0]));
  if (!cue) return null;
  const o = P(t, cue.start - 0.06, 0.12, E.linear) * (1 - P(t, cue.end, 0.12, E.linear));
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 64, display: "flex", justifyContent: "center", zIndex: 100, opacity: o }}>
      <div style={{ padding: "12px 28px 14px", borderRadius: 14, background: "rgba(21,19,19,.72)", color: C.paper, fontFamily: SANS, fontWeight: 560, fontSize: 35, lineHeight: 1.28, textAlign: "center", letterSpacing: "-0.005em" }}>
        {cue.rows.map((r, i) => (
          <div key={i}>{r}</div>
        ))}
      </div>
    </div>
  );
};
