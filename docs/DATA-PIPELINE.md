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
pnpm sync -- --dry-run                        # print, no DB
pnpm sync                                     # today ±1 day
pnpm sync -- --from 2026-08-01 --to 2026-09-30 --competitions epl,ucl
pnpm sync -- --no-ai
```

`.github/workflows/sync.yml` runs it every 15 minutes with repository secrets. Point `DATABASE_URL` at a reachable database (Neon, Supabase, RDS…) and set `DATA_SOURCE=db` on the deployed site.

## Seeding competitions, teams and squads

`scripts/sync.ts` seeds competition and team definitions from `data/demo/*.json`. Squad ingestion through `fetchSquad` is implemented in the football-data adapter and is the next piece to wire into the store (see roadmap).
