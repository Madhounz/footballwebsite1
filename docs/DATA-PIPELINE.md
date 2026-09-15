# Data pipeline

Goal: every score, table and squad on ninety is right, and when two sources disagree we can show why we chose what we chose.

```
providers ──▶ normalise ──▶ reconcile ──▶ AI validator ──▶ PostgreSQL ──▶ site
 (N APIs)     (ids, names)  (per field)   (conflicts only)  (+ provenance)
```

## 1. Providers

A `Provider` (`src/lib/pipeline/types.ts`) fetches matches, teams and squads for one competition and returns them in our own domain vocabulary. Two adapters ship:

| Provider          | Env var                 | Notes                                                                                |
| ----------------- | ----------------------- | ------------------------------------------------------------------------------------ |
| football-data.org | `FOOTBALL_DATA_API_KEY` | Free tier covers PL, PD, BL1, SA, CL at 10 req/min. EL needs a paid tier. Weight 0.8 |
| API-Football      | `API_FOOTBALL_KEY`      | Independent second source for cross-checking. Weight 0.7                             |

Every provider with a key is used. Add a source by implementing `Provider` and registering it in `providers/index.ts`.

Kooora, FotMob, 365Scores and Google do not offer public APIs and their terms prohibit scraping; they are useful as manual spot-checks, not as automated sources. The adapter pattern means a licensed feed (Opta/Stats Perform, Sportradar, Sportmonks) can be added later without touching the rest.

## 2. Normalise

Provider names are mapped to canonical team ids by `resolveTeamId`: normalise (strip "FC", diacritics, punctuation), look up the alias table, then compare with known names. Unknown names are reported at the end of a run, and — when Claude is configured — matched by the AI with a confidence. Confirmed matches are added to `TEAM_ALIASES` by a human. A team is never created implicitly.

## 3. Reconcile

`reconcileMatches` groups records by canonical key and decides each field (`kickoff`, `status`, `score`, `halfTimeScore`, `round`):

| Situation                       | Result      | Confidence                     |
| ------------------------------- | ----------- | ------------------------------ |
| all providers agree             | `consensus` | 1.0                            |
| strict majority                 | `majority`  | share of agreeing weight       |
| tie (e.g. two providers differ) | `weight`    | ≤ 0.5, flagged for the AI step |
| only one provider               | `consensus` | 0.6                            |

Events (goals, cards, substitutions) are unioned and de-duplicated across providers.

## 4. AI validator

`AIValidator` (`src/lib/pipeline/ai-validator.ts`) uses the Anthropic SDK with structured outputs. For each unresolved conflict it receives every provider's value, when each provider last updated, and context (teams, kickoff, status). It answers with a chosen provider, a confidence and one or two sentences of reasoning. Rules baked into the system prompt:

- choose only among the provided values, never invent one;
- prefer the most recently updated provider for live or just-finished matches;
- decline (null, low confidence) rather than guess.

Answers below `minConfidence` (0.8) stay unresolved and the run exits non-zero so someone looks. Every decision, including the reasoning, is stored in `Discrepancy`.

The model is `claude-opus-5` (override with `NINETY_AI_MODEL`). The system prompt is marked for prompt caching. Server-side refusal fallbacks are not enabled; the validator treats a refusal as "unresolved", which is the safe outcome for this use.

## 5. Store and provenance

`PrismaSyncStore` upserts matches and events and records:

- `SyncRun` — when, which providers, counts, errors;
- `Discrepancy` — per field: values by provider, resolution, who resolved it (`consensus | majority | weight | ai | unresolved`), confidence, reasoning;
- `SourceRecord` / `EntityAlias` — raw payloads and id mappings (tables exist; wiring raw payload storage is on the roadmap).

## Running it

```bash
pnpm sync -- --seed                           # first run: teams + squads, then the whole season
pnpm sync                                     # every later run: whole season's matches (one request per competition)
pnpm sync -- --dry-run                        # print, no DB
pnpm sync -- --from 2026-09-01 --to 2026-09-30 --competitions epl,ucl
pnpm sync -- --no-ai
```

`--seed` asks the provider for the competition's team list this season. Known clubs are matched through the alias table; a club the alias table has never seen (a newly promoted side, a first-time UEFA qualifier) is created from the provider's team record, logged as `new:` in the output, and appended to the in-memory alias list so its matches resolve in the same run. Matches alone never create teams.

`.github/workflows/sync.yml` runs it every 15 minutes with repository secrets. Point `DATABASE_URL` at a reachable database (Neon, Supabase, RDS…) and set `DATA_SOURCE=db` on the deployed site.

## Going live, step by step

1. Get a football-data.org key (free): https://www.football-data.org/client/register
2. Create a PostgreSQL database (free tiers: Neon, Supabase, or Vercel Storage → Neon).
3. In GitHub → Settings → Secrets and variables → Actions add secrets `DATABASE_URL` and `FOOTBALL_DATA_API_KEY`, and the variable `SYNC_ENABLED=true`.
4. Actions → **Sync data** → Run workflow with _seed_ ticked. It applies migrations, seeds teams and squads, and loads the season.
5. On the host set `DATABASE_URL` and `DATA_SOURCE=db`, redeploy.

The 15-minute cron keeps results fresh; the 04:17 UTC daily run re-seeds squads.

### Known limits of the free football-data tier

- No Europa League (needs a paid tier); the UEL pages stay empty until a second provider covers it.
- No match events, line-ups or live minute. Scores, statuses and tables are live; the match page shows "Live" without a minute, and scorer charts stay empty until an events source is added.
