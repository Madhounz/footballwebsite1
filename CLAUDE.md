# ninety — notes for AI assistants

Read `README.md` and `docs/ARCHITECTURE.md` first. Next.js 16 conventions are in `AGENTS.md` (`params` and `searchParams` are Promises; read `node_modules/next/dist/docs/` before using an API you are unsure of).

## Commands

- `pnpm check` — lint + typecheck + tests. Run before finishing any change.
- `pnpm build` — must pass; it catches server/client boundary errors that tests do not.
- `pnpm demo:generate` — after editing `data/demo/*.json` source files.
- `pnpm sync -- --dry-run` — exercise the pipeline against real providers without a database.

## Rules of the codebase

- Pages get data only through `getRepository()`; both `DemoRepository` and `PrismaRepository` must keep implementing the full `Repository` interface.
- Standings are computed from matches (`src/lib/data/standings.ts`), never stored or trusted from a provider. `computeStandings(..., side)` gives the home-only or away-only table; those carry no movement arrows and no qualification zones, because neither means anything in half a season.
- Season facts on the stats tab (`src/lib/data/season-facts.ts`) come from scorelines, which we hold for every match — so unlike the scorer chart they need no caveat.
- Scorer charts are the exception, and the page says so: a free plan cannot give us every match's goals, so counting them ourselves publishes a chart that is quietly short. `SeasonScorer` holds the primary source's own chart (one request per competition, rotated every 30 minutes by the live refresh) and `getTopScorers` returns it with `source: "provider"`, falling back to our count with `source: "matches"`.
- Match status in demo mode is derived from the wall clock (`clockFor`); do not store statuses in the demo dataset.
- Use design tokens from `src/app/globals.css` and logical CSS properties. One accent colour. Tabular numerals for numbers.
- Every visible string goes through `next-intl` (`messages/en.json` and `messages/ar.json`, both files always updated together). Club and competition names come from `src/lib/i18n/names.ts`. Import `Link`/`redirect`/`usePathname`/`useRouter` from `@/i18n/navigation`. Pin scores, formations and other left-to-right fragments with `dir="ltr"`.
- `public/sw.js` is written by hand and stays that way: pages are network-first (a cached page is only ever read once the network has failed), hashed build output is cache-first, `/api/sync` is never intercepted, and RSC payloads (`RSC: 1` or `?_rsc=`) are never cached — a stale payload beside fresh HTML is two versions of one page. Bump `VERSION` when the strategy changes; old caches are dropped on activate.
- No `loading.tsx` in the locale tree: it would turn 404s into 200s by streaming the shell first.
- Client components only for interaction; browser-only values go through `useSyncExternalStore`.
- Followed clubs live on the device (`src/lib/following.ts`, `useFollowing`), never in an account: no sign-up stands between someone and their team's fixtures. The server cannot know the list, so anything built on it renders client-side from `/api/following` and is absent for everyone who follows nobody.
- A model never decides a factual result. `FACTUAL_FIELDS` (score, halfTimeScore, status) are settled deterministically — consensus, majority, then the primary source — and a tie on a finished match sets `Match.disputed` for review. The validator may only choose among provider values for non-factual fields, or decline, and throws if handed a factual one. Keep the model at `claude-opus-5` unless asked.
- A match page must be worth opening without a provider's match detail. `src/lib/data/match-context.ts` derives the build-up — league rows, form, streaks, home/away records and head-to-head — from scorelines alone, so it is there before kick-off, during, after, and for a match played two years ago; line-ups and the timeline sit on top of it rather than being the page. A fixture is excluded from its own build-up. Bar colours go through `barColors` (`src/lib/colors.ts`): club colours are the default, but two reds is a chart in one colour, so the away side moves to its second colour or to a neutral.
- Player pages are built from appearances (`getPlayerMatches`), derived from line-ups and events like the tables — never stored totals.
- Share cards are `opengraph-image.tsx` routes built on `src/app/og/card.tsx`. Satori is not a browser: flexbox only, margins not `gap`, no SVG crest, and Arabic text goes through `Words` because satori has no bidi.
- Match URLs use `Match.slug` (`arsenal-vs-chelsea-2026-09-19`), never the raw id; `getMatch` accepts either.
- Match ingestion never creates teams from a bare name. Only the `--seed` step may create a team, from a provider's full team record, and it must log it.
- Club crests come from the data provider (`Team.crestUrl`); `TeamCrest` falls back to a generated badge from club colours when there is none or it fails to load. No player photos or other third-party logos.
- Live freshness comes from `/api/sync` (every minute, external cron), not from GitHub's scheduler. Keep that path cheap: one combined provider request, a three-day window, and API-Football only inside the detail window and interval. The 15-minute workflow is a backstop for that cron being down, so it runs `pnpm sync -- --refresh`, which is `runLiveRefresh` itself — never a second pipeline metering the hundred-request day on its own.
- API-Football's daily allowance is counted in the database (`SyncRun.detailRequests`, summed since UTC midnight) and passed in as `spentToday`, never held in the provider object alone. The refresh is a serverless invocation that starts afresh every minute, so an in-memory budget is no budget: it would let a hundred-request plan be asked a thousand times a day, and a key that keeps asking after its quota is gone gets suspended. Failed requests count too.
- A finished match's timeline is only trustworthy once the full event list has been fetched (`Match.eventsFinalAt`); the live feed alone leaves it truncated. The catch-up pass fills old ones in, bounded by the daily detail budget — never widen it without checking the 100-request plan.
- Substitution direction is proved from the starting XI, never assumed from a provider's field order.
- Past winners are curated in `data/honours/*.json`; `pnpm honours` (and the Update honours workflow) only appends seasons from football-data and never rewrites a curated entry. `mostTitles` is all-time — increment it, never recompute it from `entries`. The free plan names winners for old seasons and none for recent ones (nothing for 2024/25 or 2025/26 in any competition), so a season just ended is added by hand from a source the owner gives — never from memory. The run prints the newest three seasons it was offered, so a plan that starts serving them will be visible rather than assumed.
- Schema changes need a migration folder under `prisma/migrations/`; Vercel applies pending migrations at build time through `scripts/migrate-if-db.mjs`.
- Demo players and results are synthetic; do not present them as real anywhere.

## Where things are

| Area           | Path                                   |
| -------------- | -------------------------------------- |
| Domain types   | `src/lib/types.ts`                     |
| Data access    | `src/lib/data/`                        |
| Pipeline       | `src/lib/pipeline/`                    |
| Routes         | `src/app/[locale]/`                    |
| Translations   | `messages/`, `data/i18n/`, `src/i18n/` |
| Components     | `src/components/`                      |
| Demo generator | `scripts/generate-demo.ts`             |
| DB schema      | `prisma/schema.prisma`                 |
| Brand assets   | `public/brand/`, `src/app/icon.svg`    |
