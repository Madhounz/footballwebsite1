# Architecture

## One interface, two sources

Everything the UI renders comes through `Repository` (`src/lib/data/repository.ts`). Two implementations exist:

- `DemoRepository` — reads `data/demo/dataset.json` (generated, seeded). Dates are shifted so the dataset's anchor day is always "today"; status, live minute and visible events are derived from the wall clock at request time (`clockFor`). This makes the demo look alive at any hour without a database.
- `PrismaRepository` — PostgreSQL through Prisma 7 with the `pg` driver adapter. Filled by the sync pipeline.

`getRepository()` picks one from `DATA_SOURCE`. Pages, layouts and API routes never import a source directly.

## Derived, not stored

League tables (`computeStandings`) and scorer charts (`computeScorers`) are computed from matches and events at read time in both repositories. A provider's own "standings" endpoint is never used, so a table cannot disagree with the results on the site. The cost is a few milliseconds per request; caching can be added at the repository level if it ever matters.

## Languages

Routes live under `src/app/[locale]/`. `next-intl` handles detection (cookie, then `Accept-Language`) in `src/proxy.ts`, prefixes Arabic URLs with `/ar`, and leaves English unprefixed. UI strings are in `messages/{en,ar}.json`; club and competition names are curated in `data/i18n/` and resolved by `src/lib/i18n/names.ts` (falling back to English). Dates go through `Intl` with Western digits in both languages. Layout is right-to-left in Arabic via `dir="rtl"` on `<html>`; components use logical CSS properties, and anything that must stay left-to-right (scores, formations, form badges) is pinned with `dir="ltr"`. Always import `Link`, `redirect`, `usePathname` and `useRouter` from `@/i18n/navigation`, never from Next directly.

## Rendering

All routes are server components rendered on demand (`dynamic = "force-dynamic"` in the root layout) because match status depends on the current time. Client components are limited to: search palette, theme toggle, date picker, tab highlighting, local-time formatting and the live auto-refresh (`router.refresh()` every 20–30 s while something is in play).

Kickoff times are rendered in UTC on the server and in the visitor's timezone after hydration through `useSyncExternalStore`, which avoids both a flash and a hydration warning.

## Routes

| Route                                      | Purpose                                            |
| ------------------------------------------ | -------------------------------------------------- |
| `/`                                        | today's matches + table leaders                    |
| `/matches/[date]`                          | any calendar day (redirects to `/` for today)      |
| `/leagues`                                 | all competitions with compact tables               |
| `/leagues/[slug]`                          | full table + next matchday                         |
| `/leagues/[slug]/fixtures`                 | remaining matches by matchday                      |
| `/leagues/[slug]/results`                  | played matches by matchday, latest first           |
| `/leagues/[slug]/stats`                    | top scorers and assists                            |
| `/leagues/[slug]/history`                  | past winners and most titles                       |
| `/teams`, `/teams/[slug]`                  | club directory and club page                       |
| `/players/[slug]`                          | player page                                        |
| `/match/[id]`                              | match centre: score, line-ups, timeline, form, h2h |
| `/about`                                   | product story and data methodology                 |
| `/api/matches`, `/api/live`, `/api/health` | JSON                                               |

## Identity and slugs

Team ids are stable kebab-case slugs (`manchester-united`) defined in `data/demo/teams.json`; the same ids are used by the database and by the pipeline's alias table. Match ids in the database are canonical keys `competition:YYYY-MM-DD:home:away`, so the same fixture from different providers lands on the same row.

## Testing

Vitest covers the pure parts: reconciliation, name normalisation, standings maths, date helpers, and the demo repository's consistency (live score equals revealed goals, future matches hide results, tables are complete). Playwright is used ad hoc for screenshots; there is no browser test suite yet.

## Installable, and readable offline

`public/sw.js` makes the site installable and keeps the last pages someone
opened. Its one rule is that a score is never served stale: pages go to the
network first and the cached copy answers only when the network has already
failed, so the offline copy is a fallback rather than a source. Build output is
content-hashed and cache-first; `/api/sync` is never intercepted; RSC payloads
are never cached, because one of those served beside fresh HTML is two versions
of the same page.

A page nobody has opened falls back to `public/offline.html` — one file, no
dependencies, both languages, since anything it had to fetch would fail for the
same reason it is being shown.

`vercel.json` states the two cache headers this depends on. `/sw.js` must
revalidate every time: a worker a CDN is holding on to cannot be replaced by
deploying a new one, which is the only unrecoverable caching mistake here. The
icons are not content-hashed, so they get a week rather than a year — long
enough to cost nothing, short enough that changing the mark still reaches
people.
