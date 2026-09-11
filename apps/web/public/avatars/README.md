# Level avatars

Ten characters, one per overall level. The app looks for `level-1.png` through
`level-10.png` here and falls back to the emoji in `src/lib/levels.js` for any
that is missing — so a half-finished set degrades to the emoji rather than to
broken images.

**Turning them on:** set `AVATAR_ASSETS_PRESENT = true` in
`apps/web/src/lib/levels.js` once the files are in place. Until then the emoji
is used even if the files exist, so a partial set never ships half-drawn.

## What each file has to be

- **512 x 512 px, PNG, transparent background.**
- The character centred, filling roughly 80% of the frame. It is drawn inside a
  circle at 136 px in the modal and 44 px in the profile grid, so anything near
  the corners is cut off and fine detail disappears.
- One consistent style across all ten — same line weight, same proportions,
  same lighting. They are seen next to each other in the profile grid, where a
  mismatch is obvious.
- Under 200 KB each; they all load together on the profile page.

## The ten, with the colour each is framed in

| File | Level | Title | Frame colour | Character |
|------|-------|-------|--------------|-----------|
| level-1.png | 1 | Green Novice | `#6c5ce7` | a beginner: plain clothes, a sapling or a satchel, hopeful rather than capable |
| level-2.png | 2 | Steady Apprentice | `#00cec9` | a student: books under one arm, first proper gear |
| level-3.png | 3 | Daily Practitioner | `#fdcb6e` | someone who trains daily: practical kit, sleeves rolled up |
| level-4.png | 4 | Forged Master | `#e17055` | assured and settled: a cloak or coat, a mark of rank |
| level-5.png | 5 | Diamond Expert | `#d63031` | refined and precise: crystal or gemstone motif |
| level-6.png | 6 | Tempered Hero | `#fd79a8` | armed and scarred: a blade, a battered shield |
| level-7.png | 7 | Laurel Champion | `#fdcb6e` | crowned with laurel, a trophy, unmistakably a winner |
| level-8.png | 8 | Golden Legend | `#ffeaa7` | a crown and a cape, gold throughout |
| level-9.png | 9 | Storm Titan | `#a29bfe` | immense, storm-lit, barely contained power |
| level-10.png | 10 | Radiant God | `#ffffff` | radiant and near-abstract, white and light |

The frame colour is drawn by the app as a ring around the image — the artwork
itself should sit well against it without repeating it as a background.

## A prompt that produces the set

Generate them one at a time, changing only the last sentence, so the style
stays put:

> A single character portrait for a mobile habit-tracking game avatar, centred,
> facing forward, from the chest up. Flat vector illustration, bold clean
> outlines, limited palette, soft cel shading, no text, no frame, no
> background — fully transparent. Square 512x512, character fills about 80% of
> the frame. Consistent style across a set of ten ranks.
> This one is rank N of 10: **<character description from the table>**, themed
> around the colour <frame colour>.
