# Contributing

## Setup

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Node 22+ and pnpm 10. The demo dataset means you never need a database or API keys to work on the UI.

## Before you push

```bash
pnpm check      # eslint, tsc, vitest
pnpm build      # catches server/client boundary mistakes
```

CI runs the same. Keep `pnpm format` happy (Prettier).

## Conventions

- **Data flows through `Repository`** (`src/lib/data/repository.ts`). Pages never import a data source directly; they call `getRepository()`.
- **Tables are derived, never stored.** Standings and scorer charts come from `computeStandings` / `computeScorers` over match data.
- **Server components by default.** Add `"use client"` only for interaction (search, theme, date picker, auto-refresh, tabs).
- **No `useEffect` + `setState` for derived values.** Use `useSyncExternalStore` for browser-only values (see `LocalTime`, `ThemeToggle`).
- **Design tokens live in `globals.css`.** Use `bg-surface`, `text-muted`, `border-line`, `text-accent` … not raw colours.
- **Logical properties** (`ps-`, `pe-`, `ms-`, `me-`, `text-start`) so the Arabic/RTL phase needs no rewrite.
- **Numbers are tabular.** Add `tnum` to anything that lists scores, points or minutes.
- **Providers are adapters.** New sources implement `Provider` in `src/lib/pipeline/providers/` and map names through `resolveTeamId`; never create teams implicitly.

## Changing the demo data

Edit `data/demo/teams.json` or `competitions.json`, then `pnpm demo:generate` and commit the regenerated `dataset.json`. The generator is seeded, so the diff is limited to what you changed.

## Adding a season to the honours

Prepend an entry to the relevant `data/honours/*.json` and bump `mostTitles`. Include `winnerTeamId` when the club exists in `teams.json` so it links.
