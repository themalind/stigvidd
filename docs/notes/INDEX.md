# Agent notes

Durable, project-specific notes for working in this repo — what a session had to learn the
hard way and would otherwise re-derive. One file per note; keep each to a single
fact/topic. **This directory is the memory:** record new project knowledge here, and add
its line below, rather than leaving it in a transcript.

The summary on each line is what matching runs on, so make it specific: a bare title is a
note nothing will ever recall. `node .claude/hooks/plan-eval.mjs --check-notes` fails if a
file is listed nowhere, if a line points at nothing, or if a summary is too thin to match.

Search it before re-deriving anything:

```sh
node .claude/hooks/plan-eval.mjs --match "what you are about to do"
```

Referenced from [CLAUDE.md](../../CLAUDE.md), and matched automatically against any plan
you get approved.

- [The API contract is a one-way pipeline, and the test in the middle rewrites a file](openapi-contract-snapshot.md) —
  Controllers/WebDataContracts to `web/openapi.json` to `web/src/api/generated` flows one
  way only. `OpenApiContractTests` does not just compare the snapshot, it **overwrites it
  and then fails**, so the first backend test run after any API change fails by design and
  leaves the file modified; the fix is `npm run generate:api` in web/ and commit both.
  Jenkins alone runs `git diff --exit-code -- src/api/generated`, so a stale or
  hand-edited client is a red build talking about staleness rather than about your change.
- [In a linked worktree `.git` is a FILE, and code that tests for a directory walks past it](git-worktree-repo-root.md) —
  `Directory.Exists(".git")` is false at a worktree root, which made
  `OpenApiContractTests.FindRepositoryRoot` run off the top of the filesystem and throw,
  so the whole integration suite was unrunnable in the checkout the work happens in. Use an
  exists-either-kind test. Also: `.codegraph/` is per-checkout and uncommitted, so a fresh
  worktree has no index and codegraph silently knows nothing about the tree.
- [`dotnet test` needs ConnectionStrings__StigVidd, or every integration test fails at startup](dotnet-test-connection-string.md) —
  `Program.cs` throws on the missing connection string before any code under test runs, and
  the output never names the variable. `DataSource=:memory:` satisfies the null-check;
  WebApplicationFactory swaps in SQLite regardless. The bash, PowerShell and cmd forms all
  differ, the separator is a **double** underscore, and shell state does not persist between
  Bash tool calls. Also: under the Microsoft.Testing.Platform runner that `global.json`
  selects, `dotnet test <path.csproj>` is refused — one project needs `--project`.
- [SpatiaLite in the integration tests is set up differently on Windows and on Linux](spatialite-per-os.md) —
  the csproj already splits on `$(OS)`: Windows uses the bundled `e_sqlite3`, Linux binds
  the **system** libsqlite3 via a `[ModuleInitializer]` because the bundle would shadow the
  one mod_spatialite is linked against. So a Linux box needs the distro package —
  `libsqlite3-mod-spatialite` on Debian 13, `dev-db/spatialite` on Gentoo — or the geometry
  tests fail on extension load rather than on anything you changed.
- [Build every point through GeoPointFactory — a raw NTS factory gives you SRID 0](srid-4326.md) —
  `Core/Common/GeoPointFactory.cs` is the only place the SRID and the (X = longitude,
  Y = latitude) order live, and `Geometry.DefaultFactory.WithSRID(...)` appears exactly once
  in the backend, inside it; a second occurrence in a diff is the finding. NetTopologySuite's
  default factory yields SRID 0 and nothing in the type system objects. PostGIS refuses or
  mis-measures a mixed-SRID operation while SpatiaLite enforces the column's SRID on insert,
  so the same omission can be green on one path and red on the other. `Facility.Coordinates`
  and `TrailObstacle.IncidentLocation` are nullable points and lat/long travel as a pair —
  the validators reject a half pair.
- [A new named volume in docker-compose.yml is a change to scripts/migrate.sh as well](compose-volume-needs-migrate-sh.md) —
  `migrate.sh`'s `VOLUMES=(...)` is hand-maintained and nothing enforces that it matches
  compose. An **omitted** volume produces no output at all, because `mount_args()` only warns
  about volumes it was told to look for: the backup succeeds, the migration reports success,
  and the loss surfaces on the target. `trail_imports` was missed this way and is the worked
  example — measured, 0 entries in the tarball with the old list. Extending the list is
  backward-compatible both ways (a volume a host lacks is skipped with a warning; an older
  tarball restores fine), so the only way to get it wrong is to forget it. No CI runs this
  script.
- [In backend/, a nullable warning is a build ERROR](nullable-warnings-are-errors.md) —
  `Directory.Build.props` sets `WarningsAsErrors=nullable`, so CS8602/CS8618 and friends
  fail the build rather than warning. The feedback loop is otherwise the next `dotnet test`
  minutes away, which is why a per-edit project build exists. MSBuild also prints every
  diagnostic twice, so anything parsing that output must deduplicate.
- [No .gitattributes + a generated-file diff gate = a red build that is only line endings](line-endings-and-generated-files.md) —
  Git for Windows defaults `core.autocrlf=true`, so a Windows checkout of a repo without
  `.gitattributes` gets CRLF, orval writes LF, and Jenkins' `git diff --exit-code --
  src/api/generated` then fails with "the generated API client is stale" for reasons that
  have nothing to do with the API. Four migration files were committed CRLF+BOM. Fixed with
  `* text=auto eol=lf`; keep content comparisons newline-agnostic regardless.
- [`npx tsc --noEmit` in app/ has 19 pre-existing errors, and no CI job runs it](app-typecheck-baseline.md) —
  nothing type-checks app/: CI runs prettier, expo lint and jest, and jest-expo transpiles
  via Babel without type-checking, so a type error in app production code is caught by
  nothing. The 19 errors are all in `src/**/__tests__/*.ts`; 16 are
  `TS2304: Cannot find name 'global'` because `tsconfig.json`'s `"types": ["jest","geojson"]`
  replaces the default type roots and drops `@types/node`, and 3 are a real signature
  mismatch in `logger.test.ts`. Use 19 as the baseline before blaming your own change.
- [Known failing: TrailImport DeleteSessionAsync's cascade does not fire under SQLite](known-failing-trail-import-delete.md) —
  `TrailImportReviewIntegrationTests.DeleteSessionAsync_ShouldTakeTheProposalsWithItAndLeaveTheTrailsAlone`
  expects 0 proposals and finds 2. **Pre-existing on develop** (measured at 0e1a99e: 1358
  tests, 2 failures), so do not attribute it to your change. `DeleteSessionAsync` uses
  `ExecuteDeleteAsync`, which bypasses EF's change tracker, so the `OnDelete(Cascade)` in
  StigViddDbContext must be enforced by the database — PostgreSQL does, the SQLite test
  provider does not. Possibly platform-dependent, since Linux binds the system libsqlite3
  and Windows the bundled e_sqlite3.
- [The rules that keep a hook working on Windows, Gentoo and Debian at once](agent-harness-hooks.md) —
  hooks are Node `.mjs` because `python3` does not exist on Windows; registered in **exec
  form** because Claude Code expands `${CLAUDE_PROJECT_DIR}` itself and Windows may fall
  back to PowerShell; never spawn a `.cmd` shim or a shell; normalise `\` to `/` before
  matching and lowercase fixed repo paths unconditionally (`fold()` is a no-op off win32 and
  left half a guard dead); `path.resolve` cannot parse a Windows root on Linux; command
  guards must strip bash, cmd and PowerShell prefix runs. Plus the exit-code contract and
  why `scripts/check-hooks.mjs` exists.
