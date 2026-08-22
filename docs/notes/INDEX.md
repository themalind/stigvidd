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
- [Geometry built in C# is SRID 0 unless you say otherwise, and the columns are 4326](srid-4326.md) —
  every geometry column is SRID 4326 and the migrations set it, but NetTopologySuite's
  default factory yields SRID 0 and nothing in the type system objects. PostGIS refuses or
  mis-measures a mixed-SRID operation while SpatiaLite enforces the column's SRID on
  insert, so the same omission can be green on one path and red on the other. Also
  `new Coordinate(x, y)` is (longitude, latitude) while the wire format is
  `{ latitude, longitude }`.
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
- [The rules that keep a hook working on Windows, Gentoo and Debian at once](agent-harness-hooks.md) —
  hooks are Node `.mjs` because `python3` does not exist on Windows; registered in **exec
  form** because Claude Code expands `${CLAUDE_PROJECT_DIR}` itself and Windows may fall
  back to PowerShell; never spawn a `.cmd` shim or a shell; normalise `\` to `/` before
  matching and lowercase fixed repo paths unconditionally (`fold()` is a no-op off win32 and
  left half a guard dead); `path.resolve` cannot parse a Windows root on Linux; command
  guards must strip bash, cmd and PowerShell prefix runs. Plus the exit-code contract and
  why `scripts/check-hooks.mjs` exists.
