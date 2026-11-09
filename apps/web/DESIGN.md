# HụiSafe web: design rules ("Sổ hụi" v3)

Identity approved by the owner (B5, kept on 08/11/2026): **"Sổ hụi, bản in sang"**. A Vietnamese hụi ledger made trustworthy:
paper, blue-black ink, a red seal that stamps when a circle is covered, a night-ink band for the landing hero.
This file turns that identity into rules. Code must follow it; change it here first, then in `app/globals.css`.

## 1. Research behind the rules (08/11/2026)

Measured with `dembrandt` on the live sites (computed CSS, not guesses):

| Site | Text colour | Accent use | Display type | Radii |
|---|---|---|---|---|
| Mercury | `#171721` ground, `#ededf3` text | indigo `#5266EB` on 3 elements only | custom display, weight 480, line-height 1.10 | 4px data, 12px cards, pill buttons |
| Stripe | ink `#061b31`, slate `#50617a` | violet `#533afd`, sparse | Söhne 300, tracking -0.025em | 4-6px |
| Wise | dark green `#163300` as text | lime `#9fe870` for the CTA | weight 600, tracking -0.03em | pills everywhere |
| Linear | greys | almost none | weight 510, tracking -0.022em | 8px + pills |
| MoMo | `#1c171a` | magenta `#d42a87` | custom; body 18px | 4-8px |
| Cake (VPBank) | navy `#071a38` | pink `#ff38a5` | **Be Vietnam Pro** 600 | pills |

Articles and studies:
- Fintech landing patterns: one primary CTA, a real product view in the hero, a trust signal in the first screen, restraint;
  red never as the primary colour (DesignRevision 2026, saasframe, Mercury breakdown by 925studios).
- Finance dashboards: "calm reads as credibility"; a verdict row first; money in motion next to the balance; exceptions surfaced;
  work queues before chart walls; colour only for state; tabular, right-aligned numerals (AdminLTE analysis of Mercury, Stripe,
  Ramp, Brex, Wise; Copilot Money; Linear's 2024 and 2026 UI refreshes).
- AI-generated look to avoid: purple gradients, Inter everywhere, centred hero plus identical cards, one radius and one shadow on
  everything, fade-up on every element, round-number stats, emoji, glow and glass, eyebrow labels above headings
  (925studios AI-slop guide, Anti-AI-slop ban list, impeccable craft floor).
- Older users (NN/g, 123 participants aged 65+): larger text, no light-grey text, larger targets, accept several input formats,
  plain-language errors, no startling motion or sound.
- Fonts: 522 of 1,959 Google families carry the `vietnamese` subset (official metadata). We keep Newsreader + Be Vietnam Pro.

## 2. Colour roles

Values live in `app/globals.css` (`:root`). Use the role, not the hex.

| Role | Token / utility | Value | Use |
|---|---|---|---|
| Paper | `bg-background` | `#f5f7fa` | page |
| Sheet | `bg-card` | `#ffffff` | panels |
| Ink | `text-foreground` | `#11203f` | text, numbers (15:1). Never pure black |
| Secondary ink | `text-muted-foreground` | `#46526b` | secondary text (6.9:1). No lighter grey for text |
| Night ink | `nen-muc` | `#0c1730` | landing hero, footer, the dashboard verdict block |
| Action on paper | `bg-action` / `bg-primary` | `#1c4bb5` | primary buttons and links on paper |
| Action on night ink | `bg-action-ink` | `#e8b04a`, text `#0c1730` | primary buttons on the dark band |
| OK | `text-state-ok` | `#0a6246` | covered, paid on time |
| Warning | `text-state-warn` on `bg-state-warn-bg` | `#5a3a00` / `#fff0bf` | not enough yet, deadline near |
| Bad / seal | `text-state-bad`, `text-le-do` | `#a91d1d` | shortfall, error; also the brand seal and "your round" mark |

Rules:
1. One primary button per screen. Its colour depends on the surface (owner decision 08/11): ochre on night ink, ink-blue on paper.
2. Blue means "you can act". State badges and decoration never use it.
3. Green/ochre/red mean state only, and always come with a word or icon.

## 3. Type

- Families: **Newsreader** (display, roman only) and **Be Vietnam Pro** 400/600 (UI, body). Hand accent: 12 KB subset of Dancing
  Script, at most a few words per page (`app/fonts/README.md`).
- Role scale (`@theme` in `globals.css`, 1rem = 18px): `text-display`, `text-h1`, `text-h2`, `text-h3`, `text-lead`,
  `text-numeral`. New code uses these instead of one-off sizes; older screens move over when they are touched.
- Body 18px minimum; secondary text 16px minimum; display type is never below 24px.
- Every amount uses tabular figures (`so-ke`) and vi-VN format ("288,48 USDC"). A ceiling shown in short form is rounded **down**.

## 4. Shape, depth, space

- Radii by role: sheets 12px, data cells 6-8px, buttons and chips are pills, seals are circles.
- Elevation is declared once: `.to-giay` = sheet with shadow, no border; `.o-phang` = flat panel with a hairline, no shadow.
- Group by proximity first; use a sheet only to group related content. Lists of items sit in one sheet separated by hairlines,
  not as a stack of identical cards.

## 5. Motion

One authored moment per page (landing: hero entrance and the coverage meter; app screens: the seal stamp and state changes).
Transform/opacity only, 80-200ms for controls, decorative loops pause off-screen, everything stops under `prefers-reduced-motion`.

## 6. Signature element: the ledger

A paper sổ hụi is a grid: one row per round, one column per member. HụiSafe shows that structure as real, accessible UI:
- `components/circle/RoundStrip.tsx`: one cell per round on every circle row (done / now / later, your round in seal red,
  each cell spoken in words).
- `components/circle/LedgerGrid.tsx`: the full "Bảng sổ hụi" in the bid room, rounds x members, a real `<table>` with row and
  column headers (1024px+), and one expandable line per round below that width. Never ruled-paper decoration.
- Every settled row comes from `DEMO_LEDGER` in `lib/sample.ts` (docs/03 section 8 branch B); the viewer is Thành viên 2,
  a member who has not received yet, because only such members may bid (docs/03 section 6.1).

## 7. Banned (ship-stoppers)

Eyebrow labels above headings; gradient text; purple-blue gradients; glass or glow as decoration; identical card grids as page
structure; a 1px border under a wide shadow; colour as the only signal; text lighter than `--muted-foreground`; emoji as icons;
round made-up statistics; two primary buttons of equal weight; animating width/height.

## 8. Layout references (09/11/2026): what we learn, what we do not take

Full notes with observed vs inferred labels: `docs/design-research/layout-references-09-11.md`. Raw captures stay in `.handover/refs/` (git-excluded).

| Reference (link) | Captured at | Measured |
|---|---|---|
| https://www.roscash.org/ | 1440, 768, 390 | dembrandt |
| https://thesusu.app/ | 1440, 768, 390 | dembrandt |
| https://cosayv.com/ | 1440, 768, 390 | dembrandt |
| https://huio.vn/ | 1440, 768, 390 | dembrandt |
| https://www.moneyfellows.com/en-us/ | 1440, 768, 390 | looked at 1440 only |
| https://mercury.com/ , https://wise.com/ | 1440, 768, 390 | looked at 1440; numbers from section 1. Mercury capture partly broken (scripted scroll), only the top is usable |
| https://monzo.com/ | 1440, 768, 390 | captured, not analysed |

Dashboards sit behind login, so dashboard patterns are inferred from the product screenshots on the public pages.

**Learned (layout, order, rhythm, buttons):** hero opens with a worked number example, not a slogan; one primary button plus a text link;
alternate light and night-ink bands to pace the page; "title left, content right" two-column blocks for FAQ and trust; a receipt-style card
for fees and the shortfall waterfall; the hero object is the real product (our coverage card, the Sổ hụi table), not an illustration;
spacing on a 4/8px scale with roughly 100 to 140px between sections at 1440 (inferred from screenshots, not measured);
dashboard: one headline number, one clear next action, circles as status rows, payout order shown as progress.

**Not taken:** logos, photos, illustrations, mascots, copy, brand colours (blue, yellow, lime, orange, green) and brand fonts of any reference.
HụiSafe keeps its own paper, blue-black ink, red seal and the roles in section 2.
