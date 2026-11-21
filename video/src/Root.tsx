import React from "react";
import { Composition } from "remotion";
import "./fonts";
import { Spike } from "./spike/Spike";
import { Board, BOARD_LENGTH } from "./board/Board";
import { Film } from "./Film";
import { FPS, HEIGHT, TOTAL_FRAMES, WIDTH } from "./plan";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="Film" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} />
      <Composition id="Board" component={Board} durationInFrames={BOARD_LENGTH} fps={1} width={1920} height={1080} />
      <Composition id="Spike" component={Spike} durationInFrames={180} fps={60} width={1920} height={1080} />
    </>
  );
};
