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
- [`AlterColumn(nullable: false)` without `oldNullable: true` emits nothing at all](altercolumn-nullable-needs-oldnullable.md) —
  `MigrationBuilder.AlterColumn` describes the column before *and* after, and `oldNullable`
  defaults to `false` — so `nullable: false` alone reads as "no change" and the `SET NOT NULL`
  never reaches the SQL. Measured: `20260630173510_HikePath` scaffolded exactly that, so
  `dbo."Hikes"."GeoPath"` is **nullable in every deployed database** while the model snapshot
  and `Hike.GeoPath`'s `required LineString` both say otherwise, and EF materialises the NULL
  into it regardless — a NullReferenceException in code the compiler called safe.
  `dotnet ef migrations has-pending-model-changes` cannot see it, because it compares the model
  to the **snapshot**, not to a database. `dotnet ef migrations script <from> <to>
  --project Infrastructure` is what shows you what will actually run, and needs no connection.
- [PostGIS treats SRID 0 as assignable, so the typmod normalises instead of rejecting](postgis-srid-coercion.md) —
  measured on PostGIS 3.5: writing an SRID-0 geometry into a `geometry(...,4326)` column, and
  `ALTER COLUMN ... TYPE geometry(...,4326)` over a column full of SRID-0 rows, both **silently
  retag** to 4326 — so EF's bare scaffold needs no `USING` and no data statement — while a
  **foreign** SRID is refused (`Geometry SRID (3006) does not match column SRID (4326)`). Which
  makes the obvious `UPDATE ... ST_SetSRID(..., 4326) WHERE ST_SRID(...) <> 4326` harmful, not
  cautious: it relabels projected SWEREF99 metres as degrees and reports success. SpatiaLite
  is the mirror image — it **rejects** a mismatched write (so a missed write site does fail the
  integration tests) but computes `ST_Distance` across mismatched SRIDs without complaint where
  PostGIS raises, so a mixed-SRID **query** is invisible to every suite. Plus how to verify a
  geometry migration on a throwaway PostGIS when `.env` is absent and compose refuses.
- [Build every geometry through GeoPointFactory — a raw NTS factory gives you SRID 0](srid-4326.md) —
  `Core/Common/GeoPointFactory.cs` is the only place the SRID and the (X = longitude,
  Y = latitude) order live, and `Geometry.DefaultFactory.WithSRID(...)` appears exactly once
  in the backend, inside it; a second occurrence in a diff is the finding. NetTopologySuite's
  default factory yields SRID 0 and nothing in the type system objects. PostGIS refuses or
  mis-measures a mixed-SRID operation while SpatiaLite enforces the column's SRID on insert,
  so the same omission can be green on one path and red on the other. `Facility.Coordinates`
  and `TrailObstacle.IncidentLocation` are nullable points and lat/long travel as a pair —
  the validators reject a half pair. Since `PathGeometrySrid4326` this covers **paths** too:
  `FromLonLatPath` builds `Trail.GeoPath`, `Hike.GeoPath` and
  `TrailImportProposal.FeatureGeometry`, and the only site that must keep the raw NTS factory
  is `LocalMetricProjection.Project`, whose coordinates are metres rather than degrees.
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
- [A popular-trails ranking test competes with the standard seed: six verified GeoPath trails at one location](seeded-trails-compete-in-ranking-tests.md) —
  writing a test for popular-trail ranking, proximity, distance or user location: `TestBase.CreateSeededFactory()`'s
  `extraSeed` is **additive**, and `Utilities.InitializeDbForTests` already supplies six
  `IsVerified` trails carrying a `GeoPath`, all starting at `(12.80, 57.62)`, with review
  averages up to 4.75. So a `GetPopularTrailOverviewsAsync` test that stands the user on that
  coordinate — the `VerifiedGeoTrail` default — hands all six the full 5.0 proximity boost, up
  to 9.75, and any `.First()` assertion is silently competing with trails it never mentions.
  Put the user location somewhere the seed cannot rank, and say so in the test.
- [SQLite enforces no foreign key unless the pragma is on, and Linux and Windows disagree](sqlite-foreign-keys-off-on-linux.md) —
  SQLite ignores every `FOREIGN KEY` clause, `ON DELETE CASCADE` included, unless
  per-connection `PRAGMA foreign_keys` is on. Windows' bundled `e_sqlite3` defaults it to 1,
  the system libsqlite3 Linux binds defaults to 0, so a database-level cascade is inert on
  Linux and fine on Windows. Bites any repository deleting a principal with
  `ExecuteDelete`/`ExecuteUpdate`, which bypasses EF's change tracker and makes the cascade
  the database's job — it is what made
  `DeleteSessionAsync_ShouldTakeTheProposalsWithItAndLeaveTheTrailsAlone` a known failure.
  Fixed by `Foreign Keys=True` in WebApplicationFactory's connection string; the pragma is a
  silent no-op inside a transaction, so it has to go there.
- [Driving `codegraph` from a hook: the bundle's own node, and why the query must be exact](codegraph-from-a-hook.md) —
  `guard-symbol-search.mjs` denies a Grep/Glob/`grep -rn` for a symbol the CodeGraph index
  provably holds, so it has to spawn `codegraph query --json` from a hook: `codegraph` on PATH
  is an sh script and a Windows shim, and the only shim-free route is the bundle's **own node**
  plus `lib/dist/bin/codegraph.js` (`--print` says which launcher resolved; the Windows bundle
  layout is the one thing unverifiable from Linux, and it fails open). `codegraph query`
  is **fuzzy** — `GeoPoint` returns 10 rows and no symbol of that name — so the match must be
  exact, and kind must agree with file-vs-symbol. But an exact match is **not a unique** one
  either: this tree has two `Utilities.cs`, two `Program`, 40+ `Create`, so the denial lists
  every hit instead of asserting one path "IS the answer", and the query limit is part of the
  message. Holding a symbol is still not being able to answer a **search** for it: the index has
  790 files and **zero markdown**, so a search scoped to `docs/`, `*.md` or to a directory
  holding only the callers must pass — gate 4 keys that on the rows already fetched rather than
  on a list of prose extensions. A **count** — `-rc`, `--count`, `| wc -l`, `output_mode=count`
  — is rejected at gate 1 before any query. A negative fixture of `[]` cannot test the
  exact-name rule at all; **thirteen** mutations are known to go red. Because a `deny` cannot be
  retried it denies **once** and lets the identical search through — for **every** identifier on
  the line, or a two-symbol command needs three attempts. Costs 40 ms on a non-candidate, 190 ms
  when the index is consulted; the budget is per **event**, not per identifier, and forgetting
  that measured 32 s against the `"timeout": 15` it is registered with. Verified silent all four
  ways CodeGraph can be missing.
- [The rules that keep a hook working on Windows, Gentoo and Debian at once](agent-harness-hooks.md) —
  hooks are Node `.mjs` because `python3` does not exist on Windows; registered in **exec
  form** because Claude Code expands `${CLAUDE_PROJECT_DIR}` itself and Windows may fall
  back to PowerShell; never spawn a `.cmd` shim or a shell; normalise `\` to `/` before
  matching and lowercase fixed repo paths unconditionally (`fold()` is a no-op off win32 and
  left half a guard dead); `path.resolve` cannot parse a Windows root on Linux; command
  guards must strip bash, cmd and PowerShell prefix runs. Plus the exit-code contract and
  why `scripts/check-hooks.mjs` exists, and three ways the command guards surprise you: they
  match a command SHAPE not a project, so `dotnet run --project MapData` — a console ETL tool
  that exits — is denied as "the API host" (run the built binary instead of loosening the
  pattern); a rule with TWO conditions can take its head from one command and its trigger word
  from an unrelated one later in the same line, so `docker compose ps || echo "not up yet"` is
  denied over the word `up` in English prose while the reversed order passes and a quoted
  `docker compose up` passes too (this note claimed the opposite until it was measured) — but a
  heredoc body line *beginning* with a guarded command IS denied, because `commandsIn()` splits
  on newlines; and the hooks `process.exit()` at module scope, so `import`-ing one to test its
  `decide()` kills the importer — spawn it with the event on stdin instead.
