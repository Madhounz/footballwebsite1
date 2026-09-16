<p align="center">
  <img src="public/brand/mark-green.svg" width="72" alt="" />
</p>
<h1 align="center">ninety</h1>
<p align="center"><strong>Ninety minutes. Nothing else.</strong><br/>A calm, fast football scores site for the Premier League, La Liga, Bundesliga, Serie A, Champions League and Europa League.</p>

---

ninety is a competitor to the big, cluttered scores sites, in English and Arabic. One page shows today's matches across every tracked competition; yesterday, tomorrow and any date are one tap away; every table, squad, player and match is reachable in two. No ads, no pop-ups. Light and dark. Fast on a phone.

Behind it sits a data pipeline that never trusts a single provider: results are fetched from several sources and reconciled field by field by a fixed rule. A disagreement about a finished result is never settled by a model — it is shown from the primary source, marked under review, and recorded. AI is used for what it is actually good at: matching clubs and players across sources, and flagging records that look wrong. Tables and scorer charts are derived from the stored results, so they can never contradict the matches you click on.

## Quick start

```bash
pnpm install
pnpm dev            # http://localhost:3000 — runs on the bundled demo dataset, no keys needed
```

Other commands:

| Command                  | What it does                                                     |
| ------------------------ | ---------------------------------------------------------------- |
| `pnpm check`             | lint + typecheck + unit tests (what CI runs)                     |
| `pnpm build`             | production build                                                 |
| `pnpm demo:generate`     | regenerate `data/demo/dataset.json` (deterministic, seeded)      |
| `pnpm sync -- --seed`    | first real-data run: teams, squads, then the whole season        |
| `pnpm sync -- --dry-run` | run the data pipeline against real providers, print, don't write |
| `pnpm db:migrate`        | create / migrate the PostgreSQL schema (needs `DATABASE_URL`)    |

Copy `.env.example` to `.env.local` (Next.js) and `.env` (Prisma and scripts) to configure keys.

## What is in the box

- **Home** — today's matches grouped by competition, live clock and auto-refresh, a date strip (±3 days) and a real date picker, plus the top three of every table.
- **Leagues** — full table with zone markers and form, fixtures and results by matchday, top scorers and assists, past winners and most titles. Same layout for the UEFA league phases.
- **Teams** — position, form, goals, next match, recent results, upcoming fixtures, the table around the club, the full squad by position, honours, every match this season.
- **Players** — season goals, assists, appearances, profile facts and position-mates.
- **Matches** — score with live minute, goal list, line-ups on a pitch by formation, bench, two-sided event timeline, both teams' form and head-to-head.
- **Search** — `⌘K` or `/` jumps to any league or club, in either script.
- **Arabic** — full right-to-left interface at `/ar` with Arabic club and competition names; the language is detected from the browser and switchable in the header.
- **API** — `/api/matches?date=YYYY-MM-DD`, `/api/live`, `/api/health`, and `/api/sync` (secret-protected, refreshes today's matches; an external cron calls it every minute).

## Stack

Next.js 16 (App Router, React 19) · TypeScript · Tailwind CSS 4 · next-intl · Prisma 7 on PostgreSQL · Anthropic SDK · Vitest · pnpm.

## Data sources

`DATA_SOURCE=demo` (default) serves a synthetic season from `data/demo/dataset.json`: real clubs and competitions, generated results, squads and players. It is shifted so the generated "today" always lands on the visitor's today, which keeps live matches, finished results and upcoming fixtures on the home page at any time.

`DATA_SOURCE=db` serves PostgreSQL filled by the pipeline. See [docs/DATA-PIPELINE.md](docs/DATA-PIPELINE.md).

Historical winners live in `data/honours/*.json` and are curated, not fetched.

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the code is organised and why
- [docs/DATA-PIPELINE.md](docs/DATA-PIPELINE.md) — providers, reconciliation, the AI validator, running it on a schedule
- [docs/DESIGN.md](docs/DESIGN.md) — name, logo, colour, type and layout rules
- [docs/HARDCODED.md](docs/HARDCODED.md) — every value the site holds fixed instead of fetching, and what would make it dynamic
- [docs/ROADMAP.md](docs/ROADMAP.md) — what comes next
- [CONTRIBUTING.md](CONTRIBUTING.md) — how to work on the repo

## Repository layout

```
data/i18n/          Arabic names for clubs and competitions
data/demo/          competitions.json, teams.json (source of truth), dataset.json (generated)
data/honours/       curated past winners per competition
docs/               architecture, pipeline, design, roadmap
prisma/             schema.prisma (Prisma 7, driver adapter)
public/brand/       logo mark, wordmark, social card
scripts/            generate-demo.ts, sync.ts
messages/           UI strings per language (en.json, ar.json)
src/app/[locale]/   routes (App Router); English at /, Arabic at /ar
src/i18n/           routing, navigation helpers, request config
src/components/     UI components
src/lib/data/       Repository interface, demo + Prisma implementations, standings maths
src/lib/pipeline/   providers, normalise, reconcile, ai-validator, sync
```
