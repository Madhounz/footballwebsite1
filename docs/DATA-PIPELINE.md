# Data pipeline

Goal: every score, table and squad on ninety is right, and when two sources
disagree we say so rather than picking a winner quietly.

**A language model is never the authority on a result.** What a match finished
is settled from the sources by a fixed rule; a disagreement is quarantined and
shown as under review. AI is used where it is genuinely better than code —
matching clubs and players across sources, and flagging records that look
wrong — and refuses factual fields even if handed one (`FACTUAL_FIELDS` in
`reconcile.ts`, enforced again in `ai-validator.ts`).

```
primary ─┐
         ├─▶ normalise ─▶ reconcile ─▶ quarantine ─▶ PostgreSQL ─▶ site
secondary┘   (ids, names)  (fixed rule)  (disputed     (+ provenance)
                                │          results)
                                └─▶ AI: entity matching, non-factual conflicts
```

## 1. Providers

A `Provider` (`src/lib/pipeline/types.ts`) fetches matches, teams and squads for one competition and returns them in our own domain vocabulary. Two adapters ship:

| Provider          | Env var                 | Notes                                                                                                                   |
| ----------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| football-data.org | `FOOTBALL_DATA_API_KEY` | Primary for fixtures and results. Free tier covers PL, PD, BL1, SA, CL at 10 req/min. EL needs a paid tier. Weight 0.85 |
| API-Football      | `API_FOOTBALL_KEY`      | Secondary: scorers, line-ups, live minute, and an independent cross-check. Weight 0.75                                  |

Every provider with a key is used. Add a source by implementing `Provider` and registering it in `providers/index.ts`.

Kooora, FotMob, 365Scores and Google do not offer public APIs and their terms prohibit scraping; they are useful as manual spot-checks, not as automated sources. The adapter pattern means a licensed feed (Opta/Stats Perform, Sportradar, Sportmonks) can be added later without touching the rest.

## 2. Normalise

Provider names are mapped to canonical team ids by `resolveTeamId`: normalise (strip "FC", diacritics, punctuation), look up the alias table, then compare with known names. Unknown names are reported at the end of a run, and — when Claude is configured — matched by the AI with a confidence. Confirmed matches are added to `TEAM_ALIASES` by a human. A team is never created implicitly.

## 3. Reconcile

`reconcileMatches` groups records by canonical key and decides each field (`kickoff`, `status`, `score`, `halfTimeScore`, `round`):

| Situation                  | Result      | Confidence               | Then                                                                            |
| -------------------------- | ----------- | ------------------------ | ------------------------------------------------------------------------------- |
| all providers agree        | `consensus` | 1.0                      | written                                                                         |
| strict majority            | `majority`  | share of agreeing weight | written                                                                         |
| tie (two providers differ) | `weight`    | ≤ 0.5                    | primary source wins; factual fields quarantined, others may go to the validator |
| only one provider          | `consensus` | 0.6                      | written                                                                         |

Trust is explicit, not incidental: football-data is primary for fixtures and
results (weight 0.85), API-Football secondary and the source of detail (0.75).
A tie therefore always settles the same way rather than on iteration order.

A tie on `score`, `halfTimeScore` or `status` for a **finished** match sets
`Match.disputed` with the field names. The primary source's value is still
stored and shown, with a "result under review" marker on the match, and the
disagreement is recorded in `Discrepancy`. Before full time the sources are
merely at different points in the match, which is lag rather than disagreement,
so nothing is flagged.

Events (goals, cards, substitutions) are unioned and de-duplicated across providers.

## 4. AI validator, on a short leash

`AIValidator` (`src/lib/pipeline/ai-validator.ts`) uses the Anthropic SDK with
structured outputs, and is allowed exactly two jobs:

- **Entity matching.** Unknown club and player names against the ones we hold.
- **Non-factual conflicts.** Kick-off times, rounds, venues.

It is refused `score`, `halfTimeScore` and `status`, and throws if a caller
passes one, so the restriction cannot be lost by a later change upstream. For
what it is allowed, it receives every provider's value, when each provider last
updated, and context, and answers with a chosen provider, a confidence and a
sentence of reasoning. Rules in the system prompt:

- choose only among the provided values, never invent one;
- prefer the most recently updated provider for live or just-finished matches;
- decline (null, low confidence) rather than guess.

Answers below `minConfidence` (0.8) stay unresolved and are reported at the end of the run. Every decision, including the reasoning, is stored in `Discrepancy` alongside the disputed results, which is the queue a person reviews.

The model is `claude-opus-5` (override with `NINETY_AI_MODEL`). The system prompt is marked for prompt caching. Server-side refusal fallbacks are not enabled; the validator treats a refusal as "unresolved", which is the safe outcome for this use.

## 5. Store and provenance

`PrismaSyncStore` upserts matches and events and records:

- `SyncRun` — when, which providers, counts, errors;
- `Discrepancy` — per field: values by provider, resolution, who resolved it (`consensus | majority | weight | ai | unresolved`), confidence, reasoning;
- `SourceRecord` / `EntityAlias` — raw payloads and id mappings (tables exist; wiring raw payload storage is on the roadmap).

## Keeping it fresh

GitHub Actions' scheduler is best-effort: short-interval cron entries are
routinely delayed or skipped, which for a scores site means a finished match
can still read "not started" an hour later. So the work is split in two.

| Job                          | Runs                                        | Does                                                                                                  |
| ---------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `GET/POST /api/sync`         | every minute, from an external cron service | today's matches only: one combined request per provider, plus metered detail when a match is in range |
| `.github/workflows/sync.yml` | daily, plus a 15-minute backstop            | daily: the whole season, and teams and squads. The backstop runs `--refresh`, which is the row above  |

The backstop is the same code, not a second pipeline. API-Football's free
plan allows a hundred requests a day and the endpoint meters them carefully;
a full-season pass running alongside it every quarter of an hour meters
nothing, and spends on matches it has already seen the requests a match in
play needs for its line-up. `pnpm sync -- --refresh` hands straight to
`runLiveRefresh`, so the two share one budget, one overlap lock and one
window, and a backstop run costs almost nothing while the cron is healthy.

The endpoint (`src/app/api/sync/route.ts` → `src/lib/pipeline/live.ts`) is
deliberately narrow so it finishes well inside a serverless timeout:

- **Window**: yesterday to tomorrow, so late finishes and early kick-offs are covered.
- **One request per provider**: `fetchAcross` asks football-data's `/v4/matches`
  for every competition at once; if the plan refuses that endpoint it falls back
  to one request per competition, still only for the three-day window.
- **Overlap lock**: a run that began under 150 seconds ago and has not finished
  blocks the next one, so a slow minute cannot pile up.
- **A budget that survives the process**: what the key has spent today is read
  from `SyncRun.detailRequests` and handed to the provider as `spentToday`. The
  header the provider returns (`x-ratelimit-requests-remaining`) is unknown
  until the first call of a run, which is useless here: each refresh is a
  serverless invocation lasting seconds, and a fresh one every minute would
  each believe the day had not started. Both limits apply and the stricter one
  wins. Failed requests count, so a key that has been suspended or rate-limited
  stops being asked rather than being asked all day.
- **Metered detail**: API-Football is touched only while a match is within 70
  minutes before or 240 minutes after kick-off, and no more often than
  `NINETY_DETAIL_INTERVAL_MIN` (default 5). Line-ups and final events are still
  fetched once per match, so a normal day stays inside the 100-request budget.
  If the budget runs out the refresh keeps working on scores alone.
- **Catching up**: a timeline built from the live feed stops wherever the last
  refresh left it, and a match played while the refresh was down has none at
  all. `Match.eventsFinalAt` records that the complete post-match list was
  fetched, so those gaps are visible rather than silent. Every 20 minutes the
  refresh fills in up to two of them, most recent first, within
  `NINETY_CATCH_UP_DAYS` (default 45) — but only while the day has spent fewer
  than 40 detail requests and the provider reports more than 60 left, so a
  match in play never loses its quota to one from last week. Until a match is
  filled in, its page says the timeline is still being completed. To repair
  faster, run the **Sync data** workflow with a catch-up count, or
  `pnpm sync -- --catch-up 20`.

Authenticate with `Authorization: Bearer $SYNC_SECRET`, or `?key=` for cron
services that cannot send headers. The comparison is constant-time. The route
answers 200 when it did work, 202 when it deliberately skipped (lock held,
nothing seeded yet), 401/409/503 when it cannot run at all.

Set up:

1. `openssl rand -hex 32` → add as `SYNC_SECRET` in Vercel, then redeploy.
2. Create a free job at cron-job.org (or any equivalent) pointing at
   `https://<site>/api/sync`, every minute, with the bearer header.

### Migrations

The Vercel build applies them, through `scripts/migrate-if-db.mjs`, and nothing
else does. Prisma Migrate takes a session-level Postgres advisory lock, and two
things competing for it (or one pooled session stranding it) produces a `P1002`
timeout that fails the deploy. So the script migrates over the direct host
rather than the pooler, clears a lock stranded by an idle session, and retries
with backoff. `DIRECT_DATABASE_URL` overrides the host if your provider does
not follow Neon's `-pooler` naming.

## Running it

```bash
pnpm sync -- --seed                           # first run: teams + squads, then the whole season
pnpm sync                                     # every later run: whole season's matches (one request per competition)
pnpm sync -- --dry-run                        # print, no DB
pnpm sync -- --from 2026-09-01 --to 2026-09-30 --competitions epl,ucl
pnpm sync -- --no-ai
```

`--seed` asks the provider for the competition's team list this season. Known clubs are matched through the alias table; a club the alias table has never seen (a newly promoted side, a first-time UEFA qualifier) is created from the provider's team record, logged as `new:` in the output, and appended to the in-memory alias list so its matches resolve in the same run. Matches alone never create teams.

`.github/workflows/sync.yml` runs the daily pass with repository secrets. Point `DATABASE_URL` at a reachable database (Neon, Supabase, RDS…) and set `DATA_SOURCE=db` on the deployed site.

## Going live, step by step

1. Get a football-data.org key (free): https://www.football-data.org/client/register
2. Create a PostgreSQL database (free tiers: Neon, Supabase, or Vercel Storage → Neon).
3. In GitHub → Settings → Secrets and variables → Actions add secrets `DATABASE_URL` and `FOOTBALL_DATA_API_KEY`, and the variable `SYNC_ENABLED=true`.
4. Actions → **Sync data** → Run workflow with _seed_ ticked. It applies migrations, seeds teams and squads, and loads the season.
5. On the host set `DATABASE_URL` and `DATA_SOURCE=db`, redeploy.

The external cron keeps results fresh minute by minute; the 15-minute workflow
is there for the hours it is down, and the 04:17 UTC daily run re-seeds squads
and sweeps the whole season.

### How the two free tiers are combined

- **football-data.org** carries every season fixture and result for PL, La Liga, Bundesliga, Serie A and the Champions League: one request per competition per run, so tables are always complete.
- **Scorer charts** come from football-data's own chart for the competition,
  one request at a time: every refresh takes whichever competition has been
  left longest, provided its chart is over 30 minutes old. Each competition is
  therefore re-read about every half hour — a dozen requests an hour across the
  six, which beside the once-a-minute match call is nothing next to that plan's
  ten a minute — and a goal appears within half an hour of the provider
  publishing it. Counting goals from our own events cannot be complete on a
  free plan — we hold events only for the matches we fetched detail for — and a
  chart that is quietly short is worse than one with a source. `getTopScorers`
  returns the stored chart when there is one and our own count otherwise, and
  the stats page names which of the two the reader is looking at. The chart is
  asked for a hundred deep rather than thirty, at the same one request: it is
  ordered by goals, and the **Most assists** list is a re-sort of it, so a
  chart that stops at thirty is the top scorers' assists rather than the
  competition's — the players who create goals without scoring many sit below
  that line and their assists never move. A hundred reaches them; nothing on
  this plan reaches a creator who has not scored at all, which is what the note
  under that list says. If the plan ever refuses a chart that deep the request
  is made again at thirty, because a refused chart is not replaced, and a chart
  left standing looks exactly like one that is not moving.
- **Past winners** live in `data/honours/*.json` — curated, so a reviewer can
  read the diff when a season is added — but the season that just finished is
  pulled rather than typed: `pnpm honours` reads each competition's winner from
  football-data, adds only seasons the file lacks, never rewrites an entry, and
  reports it when the provider disagrees with one. `mostTitles` is an all-time
  tally, wider than these files, so a new entry increments it. The **Update
  honours** workflow runs it monthly and commits what it finds. The Europa
  League is not on the free plan, so its file stays entirely hand-curated.
- **Substitutions** are read from the line-ups, not from the order of the
  provider's fields: whoever was in the starting XI cannot be the player coming
  on. Where the line-ups are unknown the provider's own convention is used
  (`player` off, `assist` on).
- **API-Football** is spent only where it adds something: one request for each day around today (all leagues at once) and one request per 20 matches for events and line-ups, and only when a match is within 70 minutes before or 4 hours after kick-off (`store.hasMatchesAround`). It is the sole source for the Europa League, so it fetches that whole season on seed runs. It reads the `x-ratelimit-requests-remaining` header and stops with a reserve of 5 left. A plan or token error disables it for the rest of the run.
- Players named in events and line-ups are matched to the squad already in the database by normalised surname, initial and shirt number (`src/lib/pipeline/players.ts`). No match → the player is created with id `af-<id>`, and either way the mapping is remembered in `EntityAlias`.
- When both providers report the same match, every field is reconciled; disagreements land in `Discrepancy` and, with an Anthropic key, go to the validator.
