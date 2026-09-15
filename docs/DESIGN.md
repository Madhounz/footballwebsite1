# Design

## Name

**ninety** — a match is ninety minutes. Lower case, one word, easy to say in any language. Written with a prime: **ninety′** — the minute mark on a match clock (90′).

## Mark

A pitch seen from above, reduced to three strokes: the halfway line, the centre circle, the centre spot. It is where every match starts. It works at 16 px as a favicon and at 400 px on a poster, in one colour, on any background.

Files: `public/brand/mark.svg` (currentColor), `mark-green.svg`, `wordmark.svg`, `social.svg` (1200×630), `src/app/icon.svg` (favicon).

## Colour

One accent. Warm neutrals. Colour carries meaning, not decoration.

| Token         | Light          | Dark      | Used for                   |
| ------------- | -------------- | --------- | -------------------------- |
| bg            | `#f6f6f3`      | `#0f0f0e` | page                       |
| surface       | `#ffffff`      | `#171716` | cards                      |
| ink           | `#121211`      | `#f2f2ef` | text                       |
| muted         | `#6d6d67`      | `#9a9a93` | secondary text             |
| line          | `#e5e5e0`      | `#272725` | hairlines                  |
| accent        | `#0e9f6e`      | `#34d399` | the prime, links, top zone |
| live          | `#16a34a`      | `#4ade80` | live dot and clock only    |
| win/draw/loss | green/grey/red | —         | form badges                |

Competition colours appear only as small dots and 3 px table markers.

## Type

System UI stack (SF, Segoe, Roboto, Inter…) with `tnum` so scores and points line up. Weights: 400 body, 500 labels, 600 headings and scores. Headings use −0.02 em tracking. Nothing is set in all caps except 11 px section labels.

## Layout rules

- 6xl container (1152 px), 16 px gutters, 14 px card radius, 1 px hairlines, almost no shadow.
- The home page is the product: matches first, dates one tap away, tables in the sidebar.
- A match row reads home · score/time · away with status underneath the score. Winner in bold, loser muted, live in green.
- Everything reachable in two taps from the home page. Search is ⌘K.
- Mobile first: rows stack, tables drop columns (W/D/L, then GF:GA, then form), the competition strip scrolls.
- Logical properties throughout so Arabic/RTL is a translation, not a redesign.

## Voice

Short. Plain. "Full time", "Kick-off", "Postponed". No exclamation marks, no "breaking".
