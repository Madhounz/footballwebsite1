# What is hardcoded

A register of everything the site holds as a fixed value rather than reading
from a provider, so that nothing quietly goes stale unnoticed. Each entry says
where it lives, why it is fixed, and what would make it dynamic.

Nothing here is a bug. Some of it should never be dynamic — a factual table
that a provider could get wrong is safer as a file a person can read in a diff.
The point of the list is to know which is which.

## 1. Goes out of date by itself

These are true today and become wrong on a schedule, whether or not anybody
touches the code.

| What                        | Where                                    | Goes stale                                                        |
| --------------------------- | ---------------------------------------- | ----------------------------------------------------------------- |
| Qualification zones         | `data/demo/competitions.json` → `zones`  | Every summer. UEFA's coefficient gives a country a fifth Champions League place some seasons; a league changes its play-off. Wrong zones colour the wrong rows of a table. |
| `teamCount`, `rounds`       | same file                                | When a league changes size, or the European league phase does      |
| Past winners, `mostTitles`  | `data/honours/*.json`                    | Every May. The free plan names no winner for a season just ended, so the newest ones are typed in by hand from a source you give |
| What the site says it covers | `messages/en.json` / `ar.json` — `meta.description`, `about.why2` ("Six competitions"), `about.testing` ("Not yet: goal scorers, line-ups, the live minute clock, and the Europa League") | Whenever coverage changes. `about.testing` is already ambiguous: the league top-scorer chart *is* live; per-match goal scorers are not. The Europa League is named as covered in `about.why2` and has no fixture source today |
| Season rollover on 1 July   | `scripts/sync.ts`                        | Never wrong, but it is a rule rather than a fact: the season is computed from the wall clock, not asked for |

**To make dynamic:** zones, `teamCount` and `rounds` are all in football-data's
competition record, so a sync could read them instead of trusting the file —
at the cost that a provider error would repaint the table. Coverage copy needs
a real fix: build those sentences from `listCompetitions()` rather than writing
them out. That is the one item here worth doing regardless.

## 2. Lookup tables — an edit is needed when the world changes

| Table                | Where                                        | Size | What it does                                              |
| -------------------- | -------------------------------------------- | ---- | --------------------------------------------------------- |
| `COMPETITION_CODES`  | `src/lib/pipeline/normalize.ts`              | 6    | Our id → football-data code and API-Football league id. A new competition starts here |
| `TEAM_ALIASES`       | `src/lib/pipeline/normalize.ts`              | ~110 | "Man Utd", "Manchester United FC" → one club. A club a provider names in a way we do not hold has its matches **skipped**, which is why every ingest path reports `onUnknownTeam` |
| `COLOR_WORDS`        | `src/lib/pipeline/providers/football-data.ts` | 17   | The provider sends club colours as words ("Red / White"), so a club's colour on the live site is a generic hex, not its brand colour. An unrecognised word becomes grey `#555555` |
| `NATIONALITY_CODES`  | same file                                    | 75   | Country name → flag code. A player from a country not listed gets no flag |
| `STATUS`             | same file                                    | 9    | Provider status → ours. New provider status = unmapped   |
| Arabic names         | `data/i18n/teams.ar.json`, `competitions.ar.json` | —    | Every club and competition name in Arabic. A newly promoted club needs a line here or it appears in English on the Arabic site |

**To make dynamic:** the alias table could be narrowed by the AI entity matcher
that already runs on unresolved names, but a model deciding which club a match
belongs to is a factual decision, so the alias file stays the source of truth
and the model only proposes. Club colours are the honest candidate for a real
improvement: a small curated colour file per club would beat the provider's
seventeen words, and `data/demo/teams.json` already holds exactly that for
every club in the demo.

## 3. Tuning constants

Deliberate numbers. Each is one line, none is a fact about football.

| Value                                     | Where                                              |
| ----------------------------------------- | -------------------------------------------------- |
| `LIVE_LIMIT_MIN = 210` — how long a match may claim to be live | `src/lib/live-status.ts`        |
| `SCORER_LIMIT = 100`, `SCORER_LIMIT_NARROW = 30`, `MIN_GAP_MS` | `providers/football-data.ts`    |
| `CHART_DEPTH = 100` — how much of the chart the stats page reads | `app/[locale]/leagues/[slug]/stats/page.tsx` |
| `DAILY_CAP = 100`, `CATCH_UP_RESERVE`, `DETAILS_BEFORE_MIN/AFTER_MIN` | `providers/api-football.ts` |
| `SCORER_INTERVAL_MIN`, `CATCH_UP_DAILY_BUDGET`, `LOCK_SECONDS`, detail windows and intervals | `src/lib/pipeline/live.ts` |
| `FOLLOW_LIMIT = 20`, `MAX_TEAMS = 20`     | `src/lib/following.ts`, `app/api/following/route.ts` |
| Sitemap window: 120 days back, 45 ahead   | `src/app/sitemap.ts`                                |
| Home page: top 3 of each table, 3 scorers, 6 clubs in form | `src/components/DayPage.tsx`, `clubsInForm` |
| Demo clock: 45' halves, 15' break         | `src/lib/data/demo.ts`                              |

`DAILY_CAP` is the one to revisit deliberately: it is API-Football's free plan,
and it must match whatever plan the key is actually on.

## 4. Infrastructure

| What                    | Where                          | Note                                                      |
| ----------------------- | ------------------------------ | ---------------------------------------------------------- |
| Refresh cadence         | external cron (1 min), `.github/workflows/sync.yml` (`*/15` backstop, `17 4 * * *` daily seed) | Two schedulers, deliberately running the same code path |
| Honours run             | `.github/workflows/honours.yml` (`23 5 1 * *`) | Monthly                                     |
| Service worker `VERSION = "v1"` | `public/sw.js`         | Hand-bumped when the caching strategy changes             |
| Cache-Control values    | `next.config.ts`, `src/app/og/card.tsx` | Icons a week, share cards an hour/day             |
| AI model `claude-opus-5` | `src/lib/pipeline/ai-validator.ts` | Overridable with `NINETY_AI_MODEL`                    |
| Locales `["en", "ar"]`  | `src/i18n/routing.ts`          | Adding a third means a third `messages/*.json`             |

## 5. Site identity

`src/lib/site.ts` — name, production URL, owner name and link, feedback URL.
All of it is env-overridable (`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_OWNER_NAME`,
`NEXT_PUBLIC_OWNER_URL`, `NEXT_PUBLIC_FEEDBACK_URL`); the values in the file are
the defaults.

## 6. Demo mode only

`data/demo/dataset.json` is a whole synthetic season — clubs and competitions
are real, every result, squad and player is invented, and it is never presented
as real. It is what the site serves unless `DATA_SOURCE=db`.

`data/demo/teams.json` carries each club's colours, city, stadium and founding
year. On the live site none of that is used: **the provider supplies city,
stadium, founded, crest and colours**, and this file feeds the demo generator —
plus the starting `knownTeams` list that `pnpm sync` resolves provider names
against.

## What is *not* hardcoded

Worth stating, because it is the rule the codebase is built on: league tables,
scorer counts, form, streaks, head-to-head, season facts and player totals are
all computed from stored matches at read time. None of them is a number anybody
typed, and none comes from a provider's own table.
