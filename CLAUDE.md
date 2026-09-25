# Stigvidd — Project Conventions

.NET 10 API + PostGIS (`backend/`, solution `backend.sln`), Expo app (`app/`), React admin UI with a
generated client (`web/`, admin.stigvidd.se), static public site (`site/`, the apex). **Nothing checks
another area's work.** Must work on Windows, Gentoo and Debian 13.

## Green, per area

```text
backend  cd backend && dotnet build && ConnectionStrings__StigVidd="DataSource=:memory:" dotnet test --no-build
web      cd web && npm run lint && npm run generate:api && git diff --exit-code -- src/api/generated && npm test && npm run build
site     cd site && npm run build
app      cd app && npm run format:check && npm run lint && npm test -- --watchAll=false --silent && npx tsc --noEmit
harness  node scripts/check-hooks.mjs          # after touching .claude/
licence  reuse lint                            # container form + trap: docs/notes/reuse-lint-*.md
stack    docker compose up -d, then /healthz and /readyz (checks the DB)
```

- Never run a dev server, watcher or `compose up` in the foreground. Use `run_in_background` or `-d`.
- Connection string: PowerShell `$env:ConnectionStrings__StigVidd="DataSource=:memory:"; …`, cmd
  `set ConnectionStrings__StigVidd=DataSource=:memory: && …`. Use a **double** underscore, set on the same command.
  To run one project: `dotnet test --project Tests/IntegrationTests/IntegrationTests.csproj --no-build`.
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
which does both. Never hand-edit generated/EF-owned files (the guard denies it); a migration's own `.cs` body is
editable while unapplied. Migrations: `cd backend && dotnet ef migrations add <Name> --project Infrastructure`.

## Backend rules

```text
StigviddAPI/Controllers/  thin; admin ones in Admin/ with [Authorize(Policy = "AdminOnly")]
WebDataContracts/         DTOs = the contract
Core/Services/            logic, returns Result / RepositoryResult
Core/Repositories/        EF queries, incl. ordering/scoring (take a `selector`)
Core/Factories/           entity -> response
Core/Validators/          auto-registered by assembly scan
Core/TrailImport/         own namespaces, NOT global using (Core/Results, Core/Spatial are)
```

- `"AdminOnly"` is an unchecked string; `EndpointAuthorizationTests` pins it and every route behind it.
- Nullable warnings are errors. **Never use the null-forgiving `!`** in C# or TS, tests included. C# tests:
  `x.Should().NotBeNull();` then use `x`. TS tests: `if (!x) throw new Error("expected x");`.
- Geometry is SRID 4326, built only via `GeoPointFactory.FromLonLat(lon, lat)`. Any other
  `WithSRID(...)` is a bug. Lat/long travel as a pair ([note](docs/notes/srid-4326.md)).
- Tests: xunit.v3 + **AwesomeAssertions** (never FluentAssertions) + Moq. Every token is
  `TestContext.Current.CancellationToken`. Integration tests inherit appsettings **and your user secrets**, so a
  local green run proves nothing about config ([note](docs/notes/integration-tests-inherit-api-config.md)).
- Web tests: Vitest (`web/vitest.config.ts`), `*.test.ts` beside source; for one file, `npx vitest run <path>`.
- A test that has never failed is not evidence (skill `prove-it-bites`).

## Cross-cutting

- **Licence per area**: `app/` is MPL-2.0 (**never add Exhibit B**); everything else is AGPL-3.0-or-later. New
  files need a matching SPDX header (`The Stigvidd Authors`) or a `REUSE.toml` entry. Keep a `.cs` BOM first; LF.
- **Hostnames**: the CORS list in `Program.cs` and Keycloak Web Origins are untested and outside the repo; both
  Caddyfiles need every block ([note](docs/notes/moving-the-admin-off-the-apex.md)).
- **Secrets**: `.env`, `mail-config/`, `*firebase-adminsdk*.json` and `DEPLOYMENT.md` hold real credentials.
  Never commit or echo them.
- **CodeGraph**: where `.codegraph/` exists, use `codegraph_explore` before grep. A denied search passes on retry.
- **Notes**: `docs/notes/` is project memory. Search it with
  `node .claude/hooks/plan-eval.mjs --match "<task>"`, and do not Read `INDEX.md` whole (71 KB). Add to it with
  `write-a-note`. The runbooks are `DEPLOYMENT.md` and `STAGING.md`; references are in `docs/*.md`.
