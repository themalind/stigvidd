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
- [On Windows `OpenApiContractTests` fails on a clean checkout, and the "contract change" is only CR bytes](openapi-snapshot-fails-on-windows-line-endings.md) —
  The test compares the served `/swagger/v1/swagger.json` against `web/openapi.json` with
  `StringComparison.Ordinal`, but `.gitattributes` keeps the snapshot at LF while the served
  document is CRLF on Windows — so it fails, rewrites the file, passes on the second run, and
  fails again after `git checkout -- web/openapi.json`. `git status` says modified while
  `git diff` prints only a CRLF warning. Strip CR from both and diff before hunting for an API
  change that is not there. Linux and CI are unaffected, which is why nothing catches it.
- [In a linked worktree `.git` is a FILE, and code that tests for a directory walks past it](git-worktree-repo-root.md) —
  `Directory.Exists(".git")` is false at a worktree root, which made
  `OpenApiContractTests.FindRepositoryRoot` run off the top of the filesystem and throw,
  so the whole integration suite was unrunnable in the checkout the work happens in. Use an
  exists-either-kind test. Also: `.codegraph/` is per-checkout and uncommitted, so a fresh
  worktree has no index and codegraph silently knows nothing about the tree.
- [`dotnet test` needs ConnectionStrings\_\_StigVidd, or every integration test fails at startup](dotnet-test-connection-string.md) —
  `Program.cs` throws on the missing connection string before any code under test runs, and
  the output never names the variable. `DataSource=:memory:` satisfies the null-check;
  WebApplicationFactory swaps in SQLite regardless. The bash, PowerShell and cmd forms all
  differ, the separator is a **double** underscore, and shell state does not persist between
  Bash tool calls. Also: under the Microsoft.Testing.Platform runner that `global.json`
  selects, `dotnet test <path.csproj>` is refused — one project needs `--project`, while
  `dotnet build --project <path.csproj>` is refused by MSBuild in the other direction (it
  takes the path positionally) with only "Switch: --project" to say so — and the
  `dotnet test --no-build` that follows then runs the **stale DLL**, so a mutation or a fix
  reports the previous binary's result.
- [The integration tests inherit StigviddAPI's appsettings.json _and_ your user secrets, so a config deletion is green locally and 337 red on CI](integration-tests-inherit-api-config.md) —
  `StigViddWebApplicationFactory` boots the real `Program.Main` and substitutes the database,
  WebDAV and `IKeycloakAdminRepository` but **no configuration**, so the host reads
  `backend/StigviddAPI/appsettings.json`, `appsettings.Development.json` and — because the
  factory runs as `Development` and StigviddAPI has a `UserSecretsId` — the developer's
  `~/.microsoft/usersecrets` too. Deleting the Keycloak client secrets from `appsettings.json`
  (commit `ab97fb3`) failed **337 of 1441** tests on Jenkins with
  `OptionsValidationException : Keycloak Admin HTTP client requires a valid absolute URI for
'AuthServerUrl'` from `AddKeycloakAdminHttpClient`'s `ValidateOnStart`, while staying green
  on any box holding those values in user secrets — so a local `dotnet test` is **not**
  evidence about a configuration change. Fixed with `KeycloakConfigPreload.cs`, a
  `[ModuleInitializer]` setting environment variables, because
  `builder.ConfigureAppConfiguration` in `ConfigureWebHost` runs too late on the
  `DeferredHostBuilder` path and still fails 337/337. Has the per-key mutation table, and the
  half no test sees: `docker-compose.yml` overrode only `auth-server-url`, so the deployed API
  had no `KeycloakAdminClient` client secret at all and every Keycloak Admin call — register,
  forgot-password, admin provisioning — was broken with nothing reporting it.
- [SpatiaLite in the integration tests is set up differently on Windows and on Linux](spatialite-per-os.md) —
  the csproj already splits on `$(OS)`: Windows uses the bundled `e_sqlite3`, Linux binds
  the **system** libsqlite3 via a `[ModuleInitializer]` because the bundle would shadow the
  one mod_spatialite is linked against. So a Linux box needs the distro package —
  `libsqlite3-mod-spatialite` on Debian 13, `dev-db/spatialite` on Gentoo — or the geometry
  tests fail on extension load rather than on anything you changed.
- [`AlterColumn(nullable: false)` without `oldNullable: true` emits nothing at all](altercolumn-nullable-needs-oldnullable.md) —
  `MigrationBuilder.AlterColumn` describes the column before _and_ after, and `oldNullable`
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
  `Core/Spatial/GeoPointFactory.cs` is the only place the SRID and the (X = longitude,
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
- [`npx tsc --noEmit` in app/ has no fixed baseline — the count depends on a gitignored generated file](app-typecheck-baseline.md) —
  nothing type-checks app/: CI runs prettier, expo lint and jest, and jest-expo transpiles
  via Babel without type-checking, so a type error in app production code is caught by
  nothing. But do NOT treat the error count as a repo constant: expo-router's typed-route
  union comes from `.expo/types/router.d.ts`, which the Expo CLI generates and `.gitignore`
  ignores, so a stale copy makes `tsc` reject routes that exist and are committed. Measured
  2026-09-05: **2 errors, exit 2**, both `hike-follow` routes added six weeks after the local
  router.d.ts was written — TS2820/TS2322, and TypeScript's "Did you mean `follow/`?" hint is
  wrong, `follow/` and `hike-follow/` are different screens. Regenerate by starting the dev
  server (background it) before believing any number. This note has recorded 19, then 0, then 2. The old 19 was `tsconfig.json`'s `"types": ["jest","geojson"]` dropping `@types/node`;
  that is resolved — `expo-env.d.ts` reaches `expo/types/global.d.ts`, so don't add `"node"`.
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
  heredoc body line _beginning_ with a guarded command IS denied, because `commandsIn()` splits
  on newlines. Worse, inside a heredoc **backticks are command substitution**, so Markdown/JSDoc
  inline code around a guarded name is a command at head position: a `cat > file.ts <<EOF` whose
  body merely mentions `` `vitest.config.ts` `` or `` `docker compose up` `` in a COMMENT is
  denied and the file is never written, while the same sentence without backticks passes — write
  file content with the Write tool. And the hooks `process.exit()` at module scope, so
  `import`-ing one to test its `decide()` kills the importer — spawn it with the event on stdin
  instead.
- [The web test environment substitutes two things quietly: Blobs and `.env`](web-vitest-environment.md) —
  `web/` now has a Vitest + jsdom suite (`npm test` = `vitest run`, config in
  **`web/vitest.config.ts`, not `vite.config.ts`**), and two of the environment defaults hand
  the code something a browser would not. `fake-indexeddb` clones through the global
  `structuredClone`, which under jsdom is **Node's**: it does not recognise a jsdom `Blob` and
  returns `{}` instead of raising, so `staged-media.ts`'s `blob instanceof Blob` filtered every
  staged file out while the code was correct — `staged-media.test.ts` installs Node's
  `Blob`/`File` over jsdom's, deliberately in that one file and **not** in `setup.ts`, because
  jsdom's `FormData` appends a Node `File` as the string `"[object File]"` and would silently
  turn every multipart upload under test into fields. And Vitest otherwise loads the
  developer's real `web/.env`, whose `VITE_OIDC_*` `keycloak-auth.ts` captures at **module
  load**, pointing the token tests at a live Keycloak —
  `test.env` in the config is what overrides it, and module-scope token caching is why those
  tests `vi.resetModules()` per case. Plus: `vitest` watches by default (`vitest run` exits, and
  `guard-long-running.mjs` now denies the watch forms, and `setup.ts` installs the pointer-capture,
  ResizeObserver and object-URL stubs jsdom lacks — without them Radix's Select fails **silently**,
  naming the option it could not find rather than the TypeError that stopped the click). The suite
  is 336 tests over 17 files, mutation-proved 14/15, 21/21, 32/32, 69/71 and 28/29 with all four
  survivors equivalent (the note says why each is, and what the two second rounds found).
  It covers the **surfaces that can change the database most** and the gate
  in front of each: the trail-import review (which selections may be batch-decided, whether
  'select all' really means all, the apply button that stays out of reach until the diff is
  read, and — in `proposal-detail` — the role that decides which feature carries a trail's
  route); the migration page, whose import replaces the database, the media and the Keycloak
  realm and is armed only by typing the host's own name; and the trail editor, where a failed
  load used to leave a live Save button over an empty form. Plus the auth provider and
  `ProtectedRoute`. Four `src/lib/` modules exist only so a large component's arithmetic can
  be tested without rendering it — `trail-import-review.ts`, `geometry-preview.ts`,
  `media-upload.ts`, `staged-media.ts`; the note has the split, what each is worth, and why the
  media upload keeps a component test on top (what is left there is effect **ordering**). It
  deliberately duplicates none of the import semantics `backend/Core/TrailImport/` already
  tests.

- [The licence is per-area, not repo-wide: `app/` is MPL-2.0 while the rest is AGPL](licence-is-per-area-not-repo-wide.md) —
  the root `LICENSE` is the AGPL but only `backend/` and `web/` are under it; `app/` is
  MPL-2.0 because Apple's App Store terms conflict with GPLv3/AGPLv3 section 6, and its
  Exhibit B is deliberately omitted so GPL/AGPL stay available as Secondary Licenses. Every
  file carries an `SPDX-License-Identifier`; generated code, EF migrations and binaries are
  declared in `REUSE.toml` instead because `guard-generated-files.mjs` denies the edit.
  `reuse lint` is the `licensing` CI job. Warns that 196 `.cs` files have a UTF-8 BOM a
  header must go after.
- [`reuse lint` needs no local install — the CI job is a container, and the tag is `5`, not `v5`](reuse-lint-needs-no-install-it-runs-as-a-container.md) —
  the `licensing` job's `fsfe/reuse-action@v5` wraps the `fsfe/reuse` Docker image, so no
  Python, pipx or venv is needed to run the same check locally. `v5` is an Actions ref and
  not an image tag: `docker run fsfe/reuse:v5` exits 125 with `not found`, and the published
  tags are `5`, `5.1.1`, `6`, `6.2.0`, `latest`. Pass `safe.directory` as
  `GIT_CONFIG_COUNT` / `GIT_CONFIG_KEY_0` / `GIT_CONFIG_VALUE_0` or git refuses the
  bind-mounted checkout and reuse walks `node_modules`, `bin/` and `obj/` instead of asking
  git. It lints the working tree, uncommitted files included. Do not hardcode the file
  count: CLAUDE.md said 1011, the tree measured 1252 on 2026-09-12, and `Missing licenses: 0`
  is the actual check.
- [FluentAssertions 8.x is not free software, and nothing in the build says so](fluentassertions-8-is-not-free-software.md) —
  version 8.0.0 onward is the Xceed Community License, non-commercial only and revocable;
  7.2.0 was the last Apache-2.0 release. `dotnet build` and `dotnet test` say nothing about
  licences: the tell is `<license type="file">` rather than an SPDX expression in the
  package's `.nuspec`. Replaced here by `AwesomeAssertions` (Apache-2.0), which renames the
  namespace in the 96 files that had `using FluentAssertions;`.
- [On Node 26 the whole `web/` test suite fails, and the error names `clear`](node-26-shadows-jsdom-localstorage.md) —
  all 383 tests fail with `Cannot read properties of undefined (reading 'clear')` because
  Node 26 defines a global `localStorage` that is undefined without `--localstorage-file`
  and shadows jsdom's, so `src/test/setup.ts`'s `afterEach` throws for every test. The repo
  pins Node 24 in `web/Dockerfile` and CI. Do not work around it with `--localstorage-file`:
  that store is shared across test files and pollutes `media-upload.test.tsx`.
- [`git diff --exit-code -- <path>` exits 0 when the path matches NOTHING, so the staleness gate fails open](diff-exit-code-pathspec-fails-open.md) —
  the pathspec is relative to the cwd and git does not complain about one that matches
  nothing, so `git diff --exit-code -- web/src/api/generated` run from inside `web/` passes
  unconditionally while `src/api/generated` reports the real 88-file difference. It fails
  OPEN, so a wrong `cd` turns the generated-client gate into a no-op that reports success.
  Locally, assert orval is idempotent (regenerate and `diff -rq` against a snapshot) instead
  of diffing against HEAD, which cannot tell "regenerated" from "not yet committed".
- [Docker's `json-file` driver has no time-based retention, so `max-size` never means "7 days"](json-file-has-no-time-retention.md) —
  `max-size`/`max-file` on the `x-logging` anchor in `docker-compose.yml` bound disk, not age:
  a quiet service keeps its oldest line forever under any size cap, and with no `logging:` key
  at all the file grows unbounded. The privacy policy's published "Serverloggar: 7 dagar" (§5,
  both languages) is held by `scripts/container-log-retention.sh` on a daily systemd timer
  (`DEPLOYMENT.md` Part 1 step 9), not by compose — and it fails silently twice over: an
  uninstalled timer deletes nothing while everything looks healthy, and log options are fixed
  at container _create_ time, so `docker compose restart` never applies the caps. Distinct
  from `OBSERVATORY_RETENTION_DAYS`, which is OpenObserve's genuinely time-based retention.
- [OpenObserve OSS has no RBAC, so the ingestion token is the only thing a public credential may be](openobserve-oss-has-no-rbac.md) —
  the `Member` role DEPLOYMENT.md told you to give the ingest account is rejected outright
  ("Custom roles not allowed"), `service_account` is accepted and silently stored as `admin`,
  and Service Accounts are Enterprise-only — every OSS account is a full admin. The only real
  boundary is an account's per-user **passcode** (the "ingestion token" on the Ingestion page,
  already base64 of `user:passcode`) versus its **login password**: measured on v0.92.2 the
  passcode ingests via `_json` and OTLP `v1/logs` but answers 401 on `/_search` and `/users`,
  while the same account's password reads every stream and creates admin users. So
  `EXPO_PUBLIC_OO_LOGS_TOKEN`, `VITE_OO_LOGS_TOKEN` and `OTLP_TOKEN` must all be ingestion
  tokens — a password in a public bundle is full control of the observatory. Passcodes do not
  work on stream-settings routes, which is why `scripts/observatory-retention.sh` needs
  `OBSERVATORY_OPS_*`. Reproducing it: `localhost:5080` fails on rootless podman (IPv4 only,
  use `127.0.0.1`), and `_search` wants microsecond times or returns `invalid time range`.
- [An EAS build never sees `app/.env`, and `eas.json` does not say which variables it does see](eas-env-vars-are-not-your-dotenv.md) —
  EAS Build uploads the working tree — uncommitted and untracked files included, since
  `requireCommit` defaults to false — but drops what `.gitignore` drops, and `app/.env` is
  git-ignored, so a cloud build reads only the variables held on EAS
  (`eas env:list --environment preview`); rename an `EXPO_PUBLIC_*` in `app/src/api/` and the
  build silently inlines `undefined` rather than failing. The profiles in `app/eas.json` declare
  no `environment`, so eas-cli infers it — store distribution to `production`, a
  `developmentClient` profile to `development`, everything else to `preview`. `eas update` is
  the real trap: without `--environment` it bundles from your **local `.env`** and pushes a
  laptop's LAN address over the air, and it prompts only from SDK 55 up. Locally `.env.local`
  beats `.env`, and a variable marked SENSITIVE on EAS is still inlined into the APK/IPA.
- [Anything in `web/public/` is already live — an HTML comment never gated it](web-public-is-already-live.md) —
  the bundler copies `publicDir` verbatim into `dist/`, `web/Dockerfile` copies `dist/` into nginx
  and Jenkins pushes it, so a draft parked in `web/public/` is published by the next merge to
  `main` with no route, no config and nothing excluding it — the `FÅR INTE DEPLOYAS FÖRRÄN`
  comments on the legal pages gated nothing and shipped inside the served HTML. Do not go looking
  in `.dockerignore`, the build config, the `Jenkinsfile` or `proxy/Caddyfile` for the thing
  holding a public/ page back; there isn't one. They are files, not routes: link them with a plain
  `<a>` (react-router `<Link>` renders `NotFoundPage`), the trailing slash matters because they
  are directories, and nginx's default `absolute_redirect on` made that 301 downgrade TLS
  visitors to http until `web/nginx.conf` set `absolute_redirect off`.
- [Loading mod_spatialite puts the system libjpeg 8 under Magick.NET, and only a full round-trip preload pins it](magick-jpeg-collides-with-mod-spatialite.md) —
  on Linux `sqlite3_load_extension` dlopens `mod_spatialite` with **RTLD_GLOBAL**, pulling
  libgeotiff -> libtiff -> `libjpeg.so.8` into the global namespace, where it interposes the
  JPEG symbols `Magick.Native-Q8-x64.dll.so` exports but links statically — so the integration
  suite dies as `Wrong JPEG library version: library is 80, caller expects 62`, as
  `JPEG parameter struct mismatch: library thinks size is 101, caller expects 0`, or as a
  `double free or corruption (fasttop)` SIGABRT (exit 134) reporting 0 failed tests. It is not
  a race; it reproduces deterministically in `mcr.microsoft.com/dotnet/sdk:10.0`. The fix is
  `Tests/IntegrationTests/MagickPreload.cs`, a `[ModuleInitializer]` that binds the symbols
  before any `SqliteConnection` opens — but binding is lazy and **per-symbol**, so an
  encode-only preload silently fixes only part of it (8 failures -> 5) and it must round-trip
  encode -> EXIF APP1 marker (`jpeg_write_marker`, via `TestImages.JpegWithGps`) -> decode
  (`ImageProcessingService.Process`, which is why an imageless AddTrail test 500s). Production
  on PostGIS/Npgsql never loads the extension and is unaffected.
- [The proxy publishes every `*_DOMAIN` as a network alias, so a stack pointed at another environment's service swallows its own request](proxy-aliases-shadow-public-hostnames.md) —
  deploying a partial/staging stack, or any compose stack that borrows another environment's
  Keycloak, OpenObserve or mail server: `docker-compose.yml`'s `proxy` service aliases
  `${WEB_DOMAIN}`, `${API_DOMAIN}`, `${MEDIA_DOMAIN}`, `${AUTH_DOMAIN}` and
  `${OBSERVATORY_DOMAIN}` onto itself on the `public` network, deliberately, so in-stack
  calls to `https://auth.<domain>` hit Caddy instead of hairpinning. The alias is
  unconditional, so setting `AUTH_DOMAIN=auth.stigvidd.se` on a stack that runs no
  `keycloak` makes THAT stack own production's hostname internally: the API's calls 502 or
  fail to connect while every value looks right, and `curl` from the host works because the
  host is not on the docker network. Test with
  `docker compose exec api getent hosts auth.stigvidd.se` — a `10.x` answer is the alias.
  `*_DOMAIN` means "names this proxy serves", never "names this stack talks to"; reach other
  environments through `KEYCLOAK_URL`/`OTLP_ENDPOINT`, which are not aliased. Paired with
  `proxy/Caddyfile.app` and `CADDYFILE=/etc/caddy/Caddyfile.app`, because Caddy has no
  conditionals and an empty site address makes it reject its entire config.
- [`docker compose up -d` cannot work on a fresh checkout, and the second blocker reports a certificate rather than a missing directory](compose-up-needs-two-hand-carried-things-that-are-not-in-the-repo.md) —
  before trying to verify anything with `docker compose up -d` / `/readyz`, or when `db`
  restart-loops on `could not load server certificate file "/etc/postgresql/certs/server.crt"`:
  the stack needs BOTH the gitignored `.env` (or `--env-file ci/build.env` for anything that
  only has to interpolate, which is enough to validate a compose edit and to `build api`) and
  the hand-carried `./db-certs` bind mount. A bind mount of a missing host path is silently
  empty, so `docker ps` shows `Up Less than a second (starting)` forever and nothing names
  `./db-certs`. Includes what to run instead for a migration: a bare `postgis/postgis` container
  plus `dotnet ef database update --connection …`, and a rollback/re-apply to exercise a
  backfill `migrationBuilder.Sql`, which no test reaches because the suites use `EnsureCreated`.
- [Adding an anonymous or admin endpoint fails a test that names neither your endpoint nor your file](new-endpoint-must-be-added-to-the-authorization-allowlist.md) —
  adding a controller action with `[AllowAnonymous]` or the `"Admin"` policy, or debugging a
  red `EndpointAuthorizationTests` / `AnonymousEndpoints_ShouldBeExactlyTheApprovedOnes` /
  `BeEquivalentTo` collection diff: `Tests/IntegrationTests/Authorization/EndpointAuthorizationTests.cs`
  pins the COMPLETE anonymous and admin endpoint lists as `string[]` literals and compares them
  against the running host's endpoint data source, so a new route turns the suite red with a
  failure pointing at a file your change never touched. Add `"<METHOD> /api/v1/<Controller>/<route>"`
  to the right array, controller cased as the class. The `add-an-endpoint` skill's Step 3 and
  Step 4 do not mention this existing test needs editing.
- [The email-verification gate is one Keycloak flag, because the app's login never passes through this API](verification-gate-lives-in-keycloak-not-the-api.md) —
  adding, changing or debugging new-user registration, email verification, or why an
  unverified user can still log in: the app does the Keycloak Direct Access Grant straight
  against Keycloak's token endpoint, so no `[Authorize]`, middleware or controller in
  `backend/` is ever in the login path. The whole gate is `Enabled = false` in
  `KeycloakAdminRepository.CreateUserAsync`, lifted by `ActivateVerifiedUserAsync`;
  `User.EmailVerifiedAt` records it but enforces nothing. Keycloak's own `VERIFY_EMAIL`
  required action was rejected because the realm is not in this repo. Keycloak answers a
  disabled account with the SAME 400 `invalid_grant` as a wrong password, differing only in
  `error_description`, so `AccountNotVerifiedError` reads the body — and because it extends
  `InvalidCredentialsError`, a screen testing the broader class first swallows it with every
  test still green. Mail scanners follow the `GET` link before the human, so
  `AlreadyVerified` is a success.
- [The Keycloak realm came from appsettings.json, not compose — and one `Keycloak:realm` feeds both authentication and the admin client](keycloak-realm-lives-in-appsettings-not-compose.md) —
  changing the Keycloak realm, or pointing a second environment at the same Keycloak:
  `appsettings.json` pins `"realm": "stigvidd"` in BOTH the `Keycloak` and
  `KeycloakAdminClient` sections and compose overrode only `auth-server-url`, so the realm
  was the one Keycloak setting needing a committed-file edit. Now
  `Keycloak__realm`/`KeycloakAdminClient__realm` come from `${KEYCLOAK_REALM:-stigvidd}`.
  Set both: `AddKeycloakWebApiAuthentication` binds the `Keycloak` section for token
  validation, and `KeycloakAdminRepository.cs:26` reads `Keycloak:realm` too — that section,
  NOT `KeycloakAdminClient`'s — while minting its token against `KeycloakAdminClient`. Set
  one only and tokens validate against one realm while registration, forgot-password and
  admin provisioning hit another, with no startup error: a runtime 404/401 from the Admin
  API. Sign-in works but every `[Authorize]` call returns 401 means the SPA's
  `VITE_OIDC_REALM` (a build arg, baked into the bundle) drifted from the API's env.
- [A markdown backtick reads as shell command substitution, so _documenting_ a dev server trips `guard-long-running`](backticks-in-prose-trip-the-long-running-guard.md) —
  writing a note, a skill or any .claude/ or docs/ file that NAMES a guarded command: a
  heredoc whose body mentions a dev server in markdown inline code is DENIED by
  guard-long-running.mjs even though nothing is being run. `commandsIn()` in
  .claude/hooks/lib.mjs starts a new command segment at every backtick, newline, `(` and
  `{`, because a backtick is real command substitution — and it sees one flat string with no
  concept of a heredoc, so the body is scanned like code. The tell is that the quoted
  "command" in the denial contains prose. Quoting does not help the way the hook's own
  self-test (`echo 'do not docker compose up here'` is allowed) suggests: that passes only
  because quoted spans are consumed first, and `<<'EOF'` quotes the body for bash, not for
  the splitter. Write the file with the Write tool instead of a heredoc.
- [A jotai-tanstack-query atom builds its own QueryClient unless `queryClientAtom` is seeded](jotai-query-atom-builds-its-own-queryclient.md) —
  a jest suite in `app/` that mounts anything reading `stigviddUserAtom` (via `ShareHikeModal`,
  `HikeDetails`) passes and then refuses to exit: "Jest did not exit one second after the test
  run has completed", for 300 s, with `--detectOpenHandles` reporting nothing. `atomWithQuery`
  falls back to a `new QueryClient()` of its own when `queryClientAtom` is unset, and that
  default five-minute `gcTime` timer holds Node's event loop open. `src/app/_layout.tsx` seeds
  the atom; `src/test/render.tsx` now does too. Running the whole suite hides it as
  "A worker process has failed to exit gracefully".
- [React Query notifies only about result fields read during render, so a test probe reads stale `data`](react-query-tracked-props.md) —
  a `useQuery` result is a Proxy (`trackResult` in `@tanstack/query-core`) and the observer
  re-renders only for fields read _during_ render. A test probe that assigns the whole result
  and reads `.data`, `isSuccess` or `staleTime` in the assertions afterwards never re-renders
  on a data-only change — `queryClient.getQueryData` holds the new value while the probe holds
  the old one, with no error and no failing `act`, so `flushUntil` just runs out of ticks.
  Reading _nothing_ is safe and reading one field is not, and the first `pending -> success`
  transition always lands, so it only bites on a later `setQueryData` or refetch.
  `renderWithProviders` sets `notifyOnChangeProps: "all"` to switch the whole optimisation off
  in tests; never set it on the hook.
- [In app/ jest tests style is assertable and geometry is not: `onLayout` never fires](app-component-testing-what-layout-can-be-asserted.md) —
  testing design, layout or position in `app/`: `jest-expo` runs no Yoga, so `onLayout` and
  `measure()` give nothing and no px position, overlap or actual truncation can be checked —
  but `toHaveStyle` over `flex`, `gap`, `maxWidth`, `borderRadius` tokens, `numberOfLines` and
  theme colours (pass `theme: AppDarkTheme` to `renderWithProviders`) catches the rules those
  bugs actually live in. Also: react-native-paper puts your `style` on derived testIDs —
  `<Button testID="x">` layout on `x-container-outer-layer`, colour on `x-container`,
  `<Dialog testID="x">` on `x-surface` — and `@expo/vector-icons` is mocked as `icon-<name>`.
  Also covers driving the tree: `waitFor` costs ~900 ms per call here and makes suites flaky,
  so flush an already-triggered change with `await act(async () => {})`, and flush between
  interactions too or the next `fireEvent` runs against a stale closure; `Platform.OS` is
  `"ios"` under jest-expo, so an Android branch (SelectInput rows vs the iOS Picker) needs an
  override; and an ESM-only package missing from `transformIgnorePatterns` fails as
  `SyntaxError: Cannot use import statement outside a module` pointing at your test file.
  And a component that measures itself renders nothing: `measureInWindow` never calls back, so
  a popover positioned off an anchor never opens — `src/test/measure.tsx` stubs it, while an
  `onLayout` handler can just be fired with `fireEvent(el, "layout", ...)`.
  Two blind spots and their fixes: a raw string under a non-`Text` host (what
  `{list.length && <X/>}` renders when the list is empty) is a red box on a device and invisible
  to `queryByText` — `jest.after-env.js` now fails any test whose tree contains one; and a
  dismissed Paper `Dialog` lingers through its 220 ms exit animation, so `renderWithProviders`
  scales Paper's animations to zero and `flushUntilGone` makes "the dialog closed" assertable.
  Plus: react-hook-form's `field.onChange` returns a promise, so a _synchronous_ `act()` around a
  hand-called `onChange` drops the update — it needs `await act(async () => {...})`.
  Plus: an _empty_ `<Text />` is the mirror case the guard misses — invisible to every query,
  but still a `gap` slot on the device; and Paper's own `<Icon source="x">` is hidden from
  accessibility, so `queryByTestId("icon-x")` needs `{ includeHiddenElements: true }` or an
  "icon is absent" assertion passes whether it renders or not.
  And two ways a _passing_ suite hangs the run: a hook whose own `gcTime` beats the client's
  `gcTime: 0` (`useTrails` asks for 24 h — `jest.after-env.js` now disposes every client), and
  a fetch left in flight, which clearing the client does not dispose — resolve the promise
  before the test returns.
  Plus two more the environment settles for you: a `Platform.select` inside a
  `StyleSheet.create` resolves at import, so flipping `Platform.OS` later cannot reach it; and
  `getByTestId(x).parent` is a composite fiber, which `toHaveStyle` refuses — give the wrapper
  its own `testID`.
- [An in-memory queue is safe in front of a database journal only if you write-then-signal, re-signal on boot, and claim in the database](in-memory-queue-in-front-of-a-database-journal.md) —
  The mail outbox triggers on a `Channel<int>` but keeps `OutboxEmails` as the truth, so a
  lost signal costs latency and never a mail. Three rules make that safe and each has a
  mutation-checked test: commit the row **before** putting its id on the channel; on every
  start move `Sending` rows back to `Pending` and re-signal **every** `Pending` id, including
  ones whose backoff has not expired (filtering that sweep by `NextAttemptAt <= now` is the
  easy mistake and strands them until the next restart); and claim by a `Pending` -> `Sending`
  transition in the database so a duplicate signal is a no-op rather than a second send. The
  retry `Task.Delay` is deliberately best-effort — killing the API mid-backoff must still
  deliver, which is the test that separates this from a polling loop. Unlike
  `TrailImportAnalysisQueue`, whose work may legitimately be lost on restart.
- [Seed an operator-editable table with `InsertData`, never `HasData`](mail-templates-seeded-with-insertdata.md) —
  `HasData` does not mean "insert once": it declares the rows as part of the EF model, so a
  later unrelated migration scaffolds `UpdateData` that silently reverts an operator's edit to
  a `MailTemplates` row — months after the seed, which is what makes it hard to attribute. Use
  hand-written `migrationBuilder.InsertData` in the scaffolded migration body (only
  `*ModelSnapshot.cs` and `*.Designer.cs` are denied; a migration body is merely warned), and
  **omit the `Id`** so the identity sequence stays ahead of the data. Cost: no test applies a
  migration, so fixtures seed their own templates — which is better test hygiene anyway.
  `HasData` stays right for lookup tables nobody edits.
- [A guard denies the whole Bash call, so a file written earlier in that same call never exists](a-denied-bash-call-runs-nothing-including-the-file-write.md) —
  A PreToolUse deny rejects the **tool call**, not the offending segment, so a heredoc writing
  a file in the same call silently does not run — and the denial message mentions only the
  command it objected to. Measured: a new unit-test file was lost this way and the suite then
  reported 1104 passed, green about a project missing the ten tests just "written", because a
  missing test file fails nothing. Caught only by filtering to the class and seeing
  `Zero tests ran`. So never combine a file write with a command a guard might refuse, and
  after adding tests check that the **total moved** (1104 -> 1114) rather than trusting
  "Passed!". Also generalises [[backticks-in-prose-trip-the-long-running-guard]] to every
  guard, not just the dev-server one: prose describing a guarded command trips it too.
- [A global query filter DOES reach `t.Reviews!.Average(...)`, and `IgnoreQueryFilters` takes a list](query-filter-reaches-navigation-aggregates.md) —
  Measured before the moderation work leaned on it: a global filter on `Review` reaches
  inside the navigation even though the eight trail-rating averages are built by the caller
  as an `Expression` and the repository only plugs them into its `Select`. Holds on EF
  InMemory and SQLite, and in both shapes — the selector-only ones and the popularity
  ranking's `let` that an `orderby` reads. So one filter covers all eight and a later
  projection inherits it. Two traps: EF 10.0.9 has the named `HasQueryFilter("Name", ...)`
  overload but dropping it takes a **collection**, `IgnoreQueryFilters(["Moderation"])`; and
  `IgnoreQueryFilters` applies to a **query**, not an entity, which matters where
  `ReviewRepository.UserReviews` is a subquery feeding `Contains` against `ReviewImages` —
  miss it and account deletion silently stops cleaning hidden reviews' files off WebDAV.
