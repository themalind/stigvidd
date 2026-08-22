# Stigvidd — Project Conventions

A .NET 10 API with PostGIS, an Expo mobile app, and a React admin web whose API client is
generated. Three areas, three toolchains, and **nothing checks another area's work** —
which is the single most useful thing to know before starting.

Developed on Windows, Gentoo and Debian 13. Anything added here has to work on all three;
where a command differs per shell, all the forms are given.

## Build & run

```sh
# backend  (.NET 10; solution is backend/backend.sln — there is nothing to build at the repo root)
cd backend && dotnet tool restore && dotnet restore && dotnet build

# web  (Vite + React 19 + TS)
cd web && npm ci && npm run build          # tsc -b && vite build

# app  (Expo)
cd app && npm ci && npm test -- --watchAll=false

# the whole stack
docker compose up -d                       # db, api, web, media, keycloak, openobserve, proxy, mailserver
```

**Never run a dev server, watcher or `docker compose up` in the foreground.** `expo start`,
`npm run dev`, `dotnet run`, `dotnet watch` and `docker compose up` (without `-d`) do not
return: the turn wedges until the tool times out and all you get back is a startup banner.
Use `run_in_background: true`, or `-d`. `.claude/hooks/guard-long-running.mjs` denies these.

### Per-OS prerequisites

| | |
| --- | --- |
| .NET | 10 SDK. `global.json` selects the **Microsoft.Testing.Platform** test runner. |
| Node | >= 22 (orval wants >= 22.18); the shipped web bundle is built on `node:24`. npm only prints `EBADENGINE` and carries on, so nothing else will tell you the version is wrong. |
| SpatiaLite | Linux only, and required for the geometry integration tests: `libsqlite3-mod-spatialite` on Debian 13, `dev-db/spatialite` on Gentoo. Windows needs nothing — the csproj pulls the bundled `e_sqlite3` instead. See [docs/notes/spatialite-per-os.md](docs/notes/spatialite-per-os.md). |

## Which signal answers which question

| question | use | and not |
| --- | --- | --- |
| is the backend green? | `cd backend && dotnet build && dotnet test --no-build`, **with `ConnectionStrings__StigVidd` set** | `dotnet test` bare — it fails at host startup on the missing connection string, and the output never names it ([note](docs/notes/dotnet-test-connection-string.md)) |
| do the web types check? | `cd web && npm run build` — `tsc -b && vite build` **is** the type check | looking for web tests; there are none |
| do the app types check? | `cd app && npx tsc --noEmit`, deliberately | CI — it runs prettier, eslint and jest, and type-checks **nothing** |
| is the API contract still in step? | the backend test run, then `cd web && npm run generate:api` | assuming a green backend means the web client is current |
| is the generated client current? | `cd web && npm run generate:api && git diff --exit-code -- src/api/generated` | GitHub Actions — only **Jenkins** runs this check |
| does a migration apply? | `docker compose up -d` and let `DbMigrationRunner` run it against real PostGIS | any test — the suites are SQLite in-memory and apply no migration |
| does the stack come up? | `docker compose up -d`, then `/healthz` (liveness) and `/readyz` (readiness, which is the one that checks the database) | GitHub CI, which builds no image and never runs compose; Jenkins does, and only on `main` |
| is the agent harness intact? | `node scripts/check-hooks.mjs` | reading the hooks and believing them |
| what did an earlier session learn? | `node .claude/hooks/plan-eval.mjs --match "<what you are about to do>"` | re-deriving it |

**What CI actually covers.** [.github/workflows/ci.yml](.github/workflows/ci.yml) has two
jobs: `backend` and `app`. There is **no web job** — `web/` is built and lint-checked only
by the [Jenkinsfile](Jenkinsfile), which also owns the generated-client staleness gate and
the image builds, and which pushes and deploys only from `main`. So a `web/` change can be
green on a GitHub PR and broken.

### The green commands, per shell

The connection string is the one place a command differs per platform, and two of the three
forms are wrong on any given box:

```
bash / Git Bash   ConnectionStrings__StigVidd="DataSource=:memory:" dotnet test --no-build
PowerShell        $env:ConnectionStrings__StigVidd="DataSource=:memory:"; dotnet test --no-build
cmd               set ConnectionStrings__StigVidd=DataSource=:memory: && dotnet test --no-build
```

The separator is a **double** underscore (it maps to `ConnectionStrings:StigVidd`); a single
one does not bind. `WebApplicationFactory` swaps in SQLite in-memory regardless, so the
value only has to satisfy `Program.cs`'s null-check — which is exactly what CI and Jenkins
do. Shell state does not persist between Bash tool calls, so it has to be on the command
that needs it.

## Generated artifacts — never hand-edit

| file | owned by | regenerate with |
| --- | --- | --- |
| `web/src/api/generated/**` | orval ([web/orval.config.ts](web/orval.config.ts)) | `cd web && npm run generate:api` |
| `web/openapi.json` | `OpenApiContractTests` — it **rewrites the file itself** and then fails once | run the backend tests, review the rewrite |
| `backend/Infrastructure/Migrations/*ModelSnapshot.cs`, `*.Designer.cs` | EF Core | `dotnet ef migrations add/remove` |

A migration's own `.cs` body **is** editable — the `*PostGIS*` migrations carry
hand-written SQL by design — but only while it is scaffolded and unapplied.

`.claude/hooks/guard-generated-files.mjs` denies edits to these. The reason they need a
guard rather than a convention is that each one accepts the edit and discards it later, at
a moment far from the edit, so the tests in between are testing the old content. See
[docs/notes/openapi-contract-snapshot.md](docs/notes/openapi-contract-snapshot.md).

## The API contract is a one-way pipeline

```
Controllers + WebDataContracts  --NSwag-->  web/openapi.json  --orval-->  web/src/api/generated
```

Change the API surface and the **first backend test run fails by design**:
`OpenApiContractTests` overwrites `web/openapi.json` with the current document and calls
`Assert.Fail`. That is not a bug in your change. Read the snapshot diff to confirm the
contract changed the way you meant, run `cd web && npm run generate:api`, commit **both**
files, and the next run is green.

## Layering

```
StigviddAPI/Controllers/       HTTP surface; thin. [Authorize] where auth is required.
WebDataContracts/              request/response DTOs — the wire shape, and the contract
Core/Services/                 business logic, returns Result / RepositoryResult
Core/Repositories/             EF queries, including all spatial ranking and ordering
Core/Factories/                entity -> response mapping
Core/Validators/               FluentValidation; auto-registered, see below
Infrastructure/Data/Entities/  EF entities and the DbContext
Infrastructure/Migrations/     EF migrations; DbMigrationRunner applies them on startup
MapData/                       one-off importers (trails, facilities, city areas)
```

- **Validators are auto-registered.** `Program.cs` calls
  `AddValidatorsFromAssemblyContaining<AddToUserFavoriteValidator>()`, so a new validator in
  `Core/Validators/` is wired up by existing there — and a validator in the wrong assembly
  is silently never called.
- **Ordering and scoring are repository concerns.** A repository takes a `selector` so it
  never builds a response model; see `TrailRepository.GetPopularTrailOverviewsAsync`.
- **Authorization.** `Program.cs` registers an `"Admin"` policy
  (`RequireRole(adminRole)`), with Keycloak realm roles mapped in
  `Authorization/KeycloakRealmRolesTransformation.cs`.
- **Nullable warnings are build ERRORS** under `backend/`
  ([Directory.Build.props](backend/Directory.Build.props) sets
  `WarningsAsErrors=nullable`), so CS8602/CS8618 fail the build rather than warning.

## Spatial data

Every geometry column is **SRID 4326** (WGS84), and
[`Core/Common/GeoPointFactory.cs`](backend/Core/Common/GeoPointFactory.cs) is the only place
that knows it — along with the `(X = longitude, Y = latitude)` order. **Build points through
it**, never a raw NTS factory:

```csharp
GeoPointFactory.FromLonLat(longitude, latitude)   // Point, SRID 4326
GeoPointFactory.ToLatitude(point) / ToLongitude(point)
```

`Geometry.DefaultFactory.WithSRID(...)` appears exactly **once** in the backend, inside that
file; a second occurrence in a diff is a bug. A raw factory yields SRID **0** with nothing in
the type system objecting, and PostGIS then refuses or mis-measures the operation while
SpatiaLite rejects the insert — so the same omission can be green on one path and red on the
other. Lat/long also travel as a **pair**: `Facility.Coordinates` and
`TrailObstacle.IncidentLocation` are nullable points, and the validators reject a half pair.

[docs/spatial-data.md](docs/spatial-data.md) is the reference for the storage model and the
wire boundary; [docs/notes/srid-4326.md](docs/notes/srid-4326.md) is the trap.

## EF migrations

```sh
cd backend
dotnet tool restore
dotnet ef migrations add <Name> --project Infrastructure
```

`--project Infrastructure` is required: without it, `dotnet ef` from `backend/` exits with
"No project was found". No `--startup-project` is needed — `Infrastructure/Data/DesignTimeDbContextFactory.cs`
supplies the context, reading the connection string from Infrastructure's **user secrets**,
which only the commands that actually connect (`database update`) require.

Nothing in the test suite applies a migration; `DbMigrationRunner` does, on API startup,
against real PostGIS.

## Testing

- `backend/Tests/UnitTests` — services, repositories, factories, validators, importers.
  EF InMemory provider, xunit.v3 + FluentAssertions + Moq.
- `backend/Tests/IntegrationTests` — one folder per controller, booting the real host
  through `StigViddWebApplicationFactory` against SQLite + SpatiaLite in-memory.
- `app` — jest via `jest-expo`.
- `web` — **no tests.** `npm run build` and `npm run lint` are all it has.

Running one project rather than the whole solution needs `--project`, because
`global.json` selects the Microsoft.Testing.Platform runner and it refuses a bare path:

```sh
cd backend && dotnet test --project Tests/IntegrationTests/IntegrationTests.csproj --no-build
```

A test that has never failed is not evidence that it works — see the `prove-it-bites`
skill before citing a new assertion.

## Docs

[docs/](docs/) holds behavioural references: [auth](docs/auth.md),
[map](docs/map.md), [media-upload](docs/media-upload.md),
[observability](docs/observability.md), [push-notifications](docs/push-notifications.md),
[record-hike](docs/record-hike.md), [spatial-data](docs/spatial-data.md).
[DEPLOYMENT.md](DEPLOYMENT.md) is the host runbook.

## Secrets

`.env`, `mail-config/` and the various `*firebase-adminsdk*.json` are gitignored and carried
by hand. `DEPLOYMENT.md` contains real credentials in places. Never commit any of them, and
never echo one into a transcript or a log — a pasted admin password lives in the session
record afterwards.

## CodeGraph is the first move for a code question

Where a `.codegraph/` directory exists at the root, `codegraph explore "<names or a
question>"` (or the `codegraph_explore` MCP tool) answers most "how does X work" / "where
is X" questions in one call, with verbatim source plus call paths. Reach for it before
grep/find.

`.codegraph/` is **per-checkout and not committed**, so a freshly created worktree has no
index and codegraph silently knows nothing about the tree. `session-start.mjs` says so on
arrival.

## The agent harness (hooks, skills, the gate)

[.claude/hooks/](.claude/hooks/) — Node, zero-dependency, registered in
[.claude/settings.json](.claude/settings.json):

| hook | when | what |
| --- | --- | --- |
| `session-start.mjs` | SessionStart | tree state, which checkout this is, whether the contract chain is mid-flight, the green commands |
| `guard-generated-files.mjs` | PreToolUse write | denies edits to generated/EF-owned files |
| `guard-build-commands.mjs` | PreToolUse Bash | `dotnet test` without the connection string, `dotnet ef` without `--project` |
| `guard-long-running.mjs` | PreToolUse Bash | foreground dev servers, watchers, `compose up` |
| `check-dotnet-build.mjs` | PostToolUse edit | builds the project owning the edited `.cs` and reports that file's errors |
| `check-lint.mjs` | PostToolUse edit | eslint on the edited TS/JS, differenced against HEAD |
| `plan-eval.mjs` | ExitPlanMode, Stop | matches an approved plan against `docs/notes/`; at the end, what the diff obliges vs what ran |

Every hook fails silent (a broken hook must never wedge a session), and every one has a
`--self-test`. **The gate is what keeps that honest:**

```sh
node scripts/check-hooks.mjs
```

It runs every self-test, asserts that every registration resolves to a file and that every
hook file is registered somewhere, requires exec form, and checks `docs/notes/INDEX.md`
against the files. Run it after touching anything under `.claude/`. Before writing a hook,
read the `add-a-hook` skill and
[docs/notes/agent-harness-hooks.md](docs/notes/agent-harness-hooks.md) — the cross-platform
rules there each exist because breaking them fails *open*.

[.claude/skills/](.claude/skills/) — `add-an-endpoint`, `add-a-migration`,
`verify-in-docker`, `prove-it-bites`, `attribute-failure`, `write-a-note`, `add-a-hook`.

## Agent notes (project memory)

[docs/notes/](docs/notes/) is this repo's durable memory: one file per fact, indexed in
[docs/notes/INDEX.md](docs/notes/INDEX.md). It is where a measured, non-obvious thing goes
so the next session does not pay for it again.

```sh
node .claude/hooks/plan-eval.mjs --match "add a facility endpoint"   # search it
node .claude/hooks/plan-eval.mjs --check-notes                       # index <-> files
```

Search it before re-deriving anything, and use the `write-a-note` skill to add to it. A
note reaches a session only if its INDEX.md line describes it well enough to match, so the
summary is load-bearing, not decoration.
