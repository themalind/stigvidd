# Stigvidd — Project Conventions

.NET 10 API + PostGIS (`backend/`, solution `backend.sln`), Expo app (`app/`), React admin UI with a
generated client (`web/`, admin.stigvidd.se), static public site (`site/`, the apex). **Nothing checks
another area's work.** Must work on Windows, Gentoo and Debian 13.

**Structure is locked.** Read `docs/conventions/<area>.md` (backend, web, app, site) before adding a
file, folder or import across folders. Backend: build errors (IDE0130 namespace = folder, IDE0161,
IDE0022 block bodies, MA0048 one type per file) and `Tests/UnitTests/ArchitectureTests`. Web, app and
site: eslint import boundaries. Change a wrong rule and its enforcer together; never add a silent exception.

## Green, per area

```text
backend  cd backend && dotnet build && ConnectionStrings__StigVidd="DataSource=:memory:" dotnet test --no-build
web      cd web && npm run lint && npm run generate:api && git diff --exit-code -- src/api/generated && npm test && npm run build
site     cd site && npm run lint && npm run build
app      cd app && npm run format:check && npm run lint && npm test -- --watchAll=false --silent && npx tsc --noEmit
harness  node scripts/check-hooks.mjs          # after touching .claude/
updates  node --test scripts/update-checks.test.mjs   # report: node scripts/check-updates.mjs [--verbose|--strict]
licence  reuse lint                            # container form + trap: docs/notes/reuse-lint-*.md
stack    docker compose up -d, then /healthz and /readyz (checks the DB)
```

- Never run a dev server, watcher or `compose up` in the foreground. Use `run_in_background` or `-d`.
- Connection string: PowerShell `$env:ConnectionStrings__StigVidd="DataSource=:memory:"; …`, cmd
  `set ConnectionStrings__StigVidd=DataSource=:memory: && …`. Use a **double** underscore, set on the same command.
  To run one project: `dotnet test --project Tests/IntegrationTests/IntegrationTests.csproj --no-build`.
- A new expo-router route fails `tsc` (TS2820) until `.expo/types/router.d.ts` (gitignored) is regenerated: run
  `CI=1 npx expo start --port 8099` in the background until the route appears in that file, then stop it.
- `npm test` type-checks nothing; `npm run build` / `npx tsc --noEmit` do. Pass `--silent` to app jest, whose
  console noise is 279 KB against a 7 KB summary.
- Node >=22.18 and not 26 (CI uses `node:24`); on 26 the web suite stops at global setup. Linux geometry tests
  need SpatiaLite ([note](docs/notes/spatialite-per-os.md)).
- Only `docker compose up -d` applies a migration (the tests use SQLite in-memory). The generated-client gate,
  image builds and compose are **Jenkins-only**, on `main`, so a stale client is green on a GitHub PR.

## Contract and generated files

`Controllers + WebDataContracts --NSwag--> web/openapi.json (gitignored) --orval--> web/src/api/generated`.
After a controller or DTO change, `dotnet build` (which exports openapi.json and warns `SV0001` if the client
is stale), then commit `src/api/generated`. `generate:api` needs a backend build first, or run `npm run build`,
which does both. Any `[ProducesResponseType]` on an action or controller drops the inferred 200, and orval then
types the success as `unknown`. Errors with a `Message.Code` are ProblemDetails + `code`; without one they're plain strings (shipped apps read those).
Never hand-edit generated/EF-owned files (the guard denies it); a migration's own `.cs` body is
editable while unapplied. Migrations: `cd backend && dotnet ef migrations add <Name> --project Infrastructure`.

## Backend rules

```text
StigviddAPI/Controllers/  thin; admin ones in Admin/ with [Authorize(Policy = "AdminOnly")]
WebDataContracts/         DTOs = the contract
Core/Interfaces/          {Repositories,Services}/<Domain>/ interfaces only; their records, enums and filters in Models/ below
Core/Services/            logic, returns Result / RepositoryResult
Core/Repositories/        EF queries, incl. ordering/scoring (take a `selector`)
Core/Factories/           entity -> response
Core/Validators/          auto-registered by assembly scan
Core/TrailImport/         own namespaces, NOT global using (Core/Results, Core/Spatial are)
```

- `"AdminOnly"` is an unchecked string; `EndpointAuthorizationTests` pins it and every route behind it.
- Nullable warnings are errors. **Never use the null-forgiving `!`** in C# or TS, tests included. C# tests:
  `x.Should().NotBeNull();` then use `x`. TS tests: `if (!x) throw new Error("expected x");`.
  A many-to-many join (`CityAreaFacility`, `CityAreaTrail`) needs no nullable navigation: query/add rows via
  `context.Set<Dictionary<string, object>>("CityAreaFacility")` + `EF.Property<int>(row, "CityAreaId")` (`CityAreaRepository.SetLinkAsync`).
- A user walk ("contribution") is a `Trail` with a `TrailContribution` row; its source is the `HikeSubmission` with
  `PublishedTrailId == trail.Id` (no inverse navigation; see `TrailRepository.GetAllTrailsForAdminAsync`).
- A `DateTime` from a request or query string goes through `UtcDates.ToUtc` before it reaches a timestamptz
  column or a comparison: Npgsql refuses a non-UTC Kind (500), and the SQLite tests never show it.
- Geometry is SRID 4326, built only via `GeoPointFactory.FromLonLat(lon, lat)`. Any other
  `WithSRID(...)` is a bug. Lat/long travel as a pair ([note](docs/notes/srid-4326.md)).
- Tests: xunit.v3 + **AwesomeAssertions** (never FluentAssertions) + Moq. Every token is
  `TestContext.Current.CancellationToken`. Integration tests inherit appsettings **and your user secrets**, so a
  local green run proves nothing about config ([note](docs/notes/integration-tests-inherit-api-config.md)).
- Web tests: Vitest (`web/vitest.config.ts`), `*.test.ts` beside source; for one file, `npx vitest run <path>`.
  Mock the network, not hooks: `createApiMock()` on `@/api/mutator`, render with `renderWithProviders`.
- Web structure (bulletproof-react, lint-enforced): server data only via React Query in `features/<x>/api/`
  (query options from orval's `get…QueryOptions`/`get…QueryKey`, never hand-made keys; mutations toast through
  `meta`). A feature never imports another feature or `app/`; compose two features in `app/routes/`.
  A new page is one row in `app/pages.ts` (route, title, sidebar); links via `config/paths.ts`. Reuse before
  writing: `useSearchState` (URL filters), `Pager`, `useConfirm`, `ToneBadge`, `useMapLibre`, `underUrl` (invalidation).
- A test that has never failed is not evidence (skill `prove-it-bites`).

## Cross-cutting

- **Licence per area**: `app/` is MPL-2.0 (**never add Exhibit B**); everything else is AGPL-3.0-or-later. New
  files need a matching SPDX header (`The Stigvidd Authors`) or a `REUSE.toml` entry. Keep a `.cs` BOM first; LF.
- **Hostnames**: the CORS list in `Extensions/CorsExtensions.cs` and Keycloak Web Origins are untested and outside the repo; all
  three `proxy/Caddyfile*` need every block ([note](docs/notes/moving-the-admin-off-the-apex.md)). A new service
  also needs proxy `depends_on`, `env.IMAGES` for main **and** staging in `Jenkinsfile`, and DEPLOYMENT.md's two
  tables. An apex-derived name (`www.`, `link.{$SITE_DOMAIN}`) needs no `.env` variable.
- **Media files are shared**: one `ImageUrl` can back many image rows, so check references before any WebDAV
  delete ([note](docs/notes/media-files-are-shared-by-many-image-rows.md)).
- **Logs**: one OpenObserve MCP server per org, each taking only its own `org_id` (`default` gives a 401):
  `openobserve` = production `3Igh0Ez9tpaLNBgzzVouYA1NyT5`, `openobserve-staging` = staging
  `3KeRfxpDWf9Hf2CiVsulKJpHWTL` ([note](docs/notes/openobserve-mcp-org-is-not-default.md)). Device-side errors
  (push token, token refresh) are only in `stigvidd_app_logs`, not `stigvidd_api_logs`; select columns, not `_timestamp, *`.
- **Secrets**: `.env`, `mail-config/` and `*firebase-adminsdk*.json` hold real credentials. Never commit or echo
  them. `DEPLOYMENT.md` is a tracked, public runbook: names variables only, never values.
- **CodeGraph**: where `.codegraph/` exists, use `codegraph_explore` before grep. A denied search passes on retry.
- **Edit with Edit/Write**, not a python/sed/heredoc rewrite through Bash: that skips the generated-file, comment
  and token guards and the per-edit build and lint (~570 such edits across the first 27 sessions).
- **Notes**: `docs/notes/` is project memory. Search it with
  `node .claude/hooks/plan-eval.mjs --match "<task>"`, and do not Read `INDEX.md` whole (83 KB). Add to it with
  `write-a-note`. The runbooks are `DEPLOYMENT.md` and `STAGING.md`; references are in `docs/*.md`.
- **Retro**: notes are recalled on each prompt; at Stop, a session that shipped and made 15+ calls (or had a
  plan) gets its measured cost and four questions. Answer them where the fact is cheapest to find next time.
  `plan-eval.mjs --report` shows the trend and the notes to promote into rules (`--backfill` seeds the ledger).
