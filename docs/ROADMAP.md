# Roadmap

## Now (this repository)

- [x] Product scaffold: home by date, leagues, teams, players, match centre, search, themes
- [x] Demo dataset generator so the site runs with zero configuration
- [x] Real historical winners for all six competitions
- [x] Repository interface with demo and PostgreSQL implementations
- [x] Pipeline: two provider adapters, reconciliation, Claude validator, provenance schema
- [x] CI (lint, typecheck, tests, build) and a scheduled sync workflow
- [x] Live data from football-data.org with official crests
- [x] Arabic interface with right-to-left layout and Arabic club names
- [x] Second source (API-Football): scorers, line-ups, live minute, Europa League

## Next

1. **Go live on real data.** Get football-data.org and API-Football keys, provision PostgreSQL, run migrations, run `pnpm sync` for the season to date, flip `DATA_SOURCE=db`.
2. **Knockout brackets** for UCL/UEL after the league phase.
3. **Follow clubs** (cookie-based at first) for a personal home page.
4. **Notifications** for goals and full-time in followed clubs.
5. **Editorial**: articles and invited critics, with an author model and a simple CMS.
6. **Observability** for the pipeline: a small `/admin/sync` page listing runs and unresolved discrepancies.
7. **Playwright smoke tests** on the main routes.
8. Widen coverage (Ligue 1, Saudi Pro League, Egyptian Premier League, AFCON) once the six are solid.
