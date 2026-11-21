import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// Inter Tight (variable 100-900) and IBM Plex Mono, both OFL, same pair as apps/web/app/fonts.ts.
export const SANS = "Inter Tight";
export const MONO = "IBM Plex Mono";

export const fontsReady = Promise.all([
  loadFont({ family: SANS, url: staticFile("fonts/InterTight-VF.ttf"), weight: "100 900" }),
  loadFont({ family: MONO, url: staticFile("fonts/IBMPlexMono-Regular.ttf"), weight: "400" }),
  loadFont({ family: MONO, url: staticFile("fonts/IBMPlexMono-Medium.ttf"), weight: "500" }),
  loadFont({ family: MONO, url: staticFile("fonts/IBMPlexMono-SemiBold.ttf"), weight: "600" }),
  loadFont({ family: MONO, url: staticFile("fonts/IBMPlexMono-Bold.ttf"), weight: "700" }),
]);
