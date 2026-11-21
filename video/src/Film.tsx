import React from "react";
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Audio } from "@remotion/media";
import { C } from "./tokens";
import { FPS, LINES } from "./plan";
import { Act1, SEAM_1_2 } from "./acts/Act1";
import { Act2, SEAM_2_3 } from "./acts/Act2";
import { Act3 } from "./acts/Act3";
import { Captions } from "./Captions";

// The whole film on one clock: t = seconds since the first frame. Acts mount only inside their window.
export const Film: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const s12 = SEAM_1_2();
  return (
    <AbsoluteFill style={{ background: C.inkDeep }}>
      {t < s12 + 0.02 && <Act1 t={t} />}
      {t >= s12 && t < SEAM_2_3() + 0.02 && <Act2 t={t} />}
      {t >= SEAM_2_3() && <Act3 t={t} />}
      <Captions t={t} />
      {LINES.filter((l) => l.hasAudio).map((l) => (
        <Sequence key={l.id} from={Math.round(l.start * FPS)} durationInFrames={Math.ceil(l.dur * FPS) + 2} layout="none">
          <Audio src={staticFile(`vo/${l.id}.mp3`)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
