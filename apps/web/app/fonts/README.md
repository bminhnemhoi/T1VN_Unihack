# so-hui-hand.woff2

Hand-written accent font for three short notes (see `font-hand` in `components/`).
It is a subset of **Dancing Script** (SIL OFL 1.1, licence in `OFL-DancingScript.txt`): only Basic Latin letters, digits and the
Vietnamese glyphs those notes need, weight axis frozen at 600, family renamed to "Sổ Hụi Hand" because the OFL reserves the name
"Dancing Script" for unmodified versions. Reason: the full Google Fonts files cost about 70 KB and delayed first paint on slow networks
(Lighthouse mobile 83 -> 92); this one is 12 KB.

If a note needs a character outside that set it falls back to `cursive`. To rebuild: take `DancingScript[wght].ttf` from
github.com/google/fonts, `pyftsubset --text-file=... --layout-features=kern,ccmp,locl,mark,mkmk`, freeze wght with
`fontTools.varLib.instancer`, rename name IDs 1/4/6/16, then `woff2_compress`.
