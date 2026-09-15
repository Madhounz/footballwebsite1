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
- Client components only for interaction; browser-only values go through `useSyncExternalStore`.
- The AI validator (`src/lib/pipeline/ai-validator.ts`) may only choose among provider values or decline; never let it invent data. Keep the model at `claude-opus-5` unless asked.
- Real crests, player photos and third-party logos are not used; `TeamCrest` generates one from club colours.
- Demo players and results are synthetic; do not present them as real anywhere.

## Where things are

| Area           | Path                                |
| -------------- | ----------------------------------- |
| Domain types   | `src/lib/types.ts`                  |
| Data access    | `src/lib/data/`                     |
| Pipeline       | `src/lib/pipeline/`                 |
| Routes         | `src/app/`                          |
| Components     | `src/components/`                   |
| Demo generator | `scripts/generate-demo.ts`          |
| DB schema      | `prisma/schema.prisma`              |
| Brand assets   | `public/brand/`, `src/app/icon.svg` |
