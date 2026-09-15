# ninety — notes for AI assistants

Read `README.md` and `docs/ARCHITECTURE.md` first. Next.js 16 conventions are in `AGENTS.md` (`params` and `searchParams` are Promises; read `node_modules/next/dist/docs/` before using an API you are unsure of).

## Commands

- `pnpm check` — lint + typecheck + tests. Run before finishing any change.
- `pnpm build` — must pass; it catches server/client boundary errors that tests do not.
- `pnpm demo:generate` — after editing `data/demo/*.json` source files.
- `pnpm sync -- --dry-run` — exercise the pipeline against real providers without a database.

## Rules of the codebase

- Pages get data only through `getRepository()`; both `DemoRepository` and `PrismaRepository` must keep implementing the full `Repository` interface.
- Standings/scorers are computed from matches (`src/lib/data/standings.ts`), never stored or trusted from a provider.
- Match status in demo mode is derived from the wall clock (`clockFor`); do not store statuses in the demo dataset.
- Use design tokens from `src/app/globals.css` and logical CSS properties. One accent colour. Tabular numerals for numbers.
- Every visible string goes through `next-intl` (`messages/en.json` and `messages/ar.json`, both files always updated together). Club and competition names come from `src/lib/i18n/names.ts`. Import `Link`/`redirect`/`usePathname`/`useRouter` from `@/i18n/navigation`. Pin scores, formations and other left-to-right fragments with `dir="ltr"`.
- No `loading.tsx` in the locale tree: it would turn 404s into 200s by streaming the shell first.
- Client components only for interaction; browser-only values go through `useSyncExternalStore`.
- The AI validator (`src/lib/pipeline/ai-validator.ts`) may only choose among provider values or decline; never let it invent data. Keep the model at `claude-opus-5` unless asked.
- Match ingestion never creates teams from a bare name. Only the `--seed` step may create a team, from a provider's full team record, and it must log it.
- Club crests come from the data provider (`Team.crestUrl`); `TeamCrest` falls back to a generated badge from club colours when there is none or it fails to load. No player photos or other third-party logos.
- Live freshness comes from `/api/sync` (every minute, external cron), not from GitHub's scheduler. Keep that path cheap: one combined provider request, a three-day window, and API-Football only inside the detail window and interval.
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
