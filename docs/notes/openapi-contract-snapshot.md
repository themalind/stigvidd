# The API contract is a one-way pipeline, and the file in the middle is not committed

The typed client the admin web uses is not written by hand. Three artifacts are chained,
and the arrow only points one way:

```
backend/StigviddAPI/Controllers/*.cs        the source of truth
backend/WebDataContracts/*.cs
        |  StigviddAPI.csproj's GenerateOpenApiSpec target, after every Debug build
        v
web/openapi.json                            a GITIGNORED export
        |  orval, `npm run generate:api` (web/orval.config.ts)
        v
web/src/api/generated/**                    react-query hooks + models
```

## The document is exported by the build

`dotnet build` refreshes `web/openapi.json`. So does the VS Code **build api** task, and so
does F5, which runs that task first. `cd web && npm run build` (or `npm run dev`) refreshes
the document *and* regenerates the client, through `web/scripts/codegen.mjs`.

The mechanism is [`scripts/generate-openapi.mjs`](../../scripts/generate-openapi.mjs),
which runs the freshly built assembly with the `--export-openapi` switch that
`Program.Main` handles between `builder.Build()` and the migration loop. It resolves the
same `IOpenApiDocumentGenerator` that serves `/swagger/v1/swagger.json`, so the exported
document and the served one agree by construction.

That interface is **declared in namespace `NSwag.Generation` but shipped inside
`NSwag.AspNetCore.dll`**, and it appears in neither package's XML documentation. Guessing
`using NSwag.AspNetCore;` from the assembly it lives in is the obvious move and does not
compile. The namespaces an assembly actually declares are greppable:

```sh
strings ~/.nuget/packages/nswag.aspnetcore/14.7.1/lib/net10.0/NSwag.AspNetCore.dll \
  | grep -E '^NSwag(\.[A-Za-z]+)*$' | sort -u
```

Only the **client** is committed, and it is what review, and the Jenkins staleness gate,
actually look at.

## It used to be a test, and that is worth remembering

`OpenApiContractTests` compared the live document against `web/openapi.json`, **wrote the
file itself**, and failed once whenever it had to change. Three failure modes came out of
making a producer out of an assertion:

- **The document only moved when someone ran the backend suite.** A contract change that
  was never regenerated into the client sat undetected until Jenkins.
- **A persistent workspace fails for nothing.** Jenkins reuses its workspace, so a snapshot
  left by the *previous commit's* build disagreed with the current API and failed the
  build — while the committed client was perfectly current. Measured on 2026-09-19: the
  failure was real, and regenerating the client afterwards produced **zero** changed files.
  The red build said "the API contract changed"; nothing was wrong.
- **The failure landed in Preflight**, before any test stage, so it read like infrastructure.

## NSwag's own CLI cannot do this

`dotnet nswag aspnetcore2openapi` was tried first and does not work here. It reaches the
service provider through `HostFactoryResolver`, which runs `Program.Main` straight past
`builder.Build()` into the `DbMigrationRunner` loop and dies on a database that generating a
document has no reason to touch:

```
at Infrastructure.DbMigrationRunner.RunMigrationsAsync(...)
at StigviddAPI.Program.Main(String[] args) in .../Program.cs:line 190
at NSwag.Commands.ServiceProviderResolver.GetServiceProviderWithHostFactoryResolver(...)
```

The `--export-openapi` switch returns *before* that loop, which is the whole reason it is a
switch in `Program.cs` rather than an external tool. Do not reintroduce the CLI.

## The generator still needs real configuration

Exporting boots the host as far as `builder.Build()`, so it reads StigviddAPI's real
configuration and needs the same four keys the integration suite pins in
[`KeycloakConfigPreload.cs`](../../backend/Tests/IntegrationTests/KeycloakConfigPreload.cs) —
`ConnectionStrings__StigVidd` plus three Keycloak values, of which
`KeycloakAdminClient__auth-server-url` is load-bearing. That list is deliberately duplicated
in `scripts/generate-openapi.mjs`; change one, change the other.

Two of those key names contain a **hyphen**, which is why the generator is a Node script and
not a shell line: `KeycloakAdminClient__auth-server-url=x cmd` is not an assignment to bash,
it is a command name, and bash answers `No such file or directory`. `process.env` has one
spelling on all three platforms.

## The gate, in Jenkins only

The Jenkinsfile `web` stage regenerates the client and then runs
`git diff --exit-code -- src/api/generated`. A stale client — or a hand edit under
`web/src/api/generated/` — fails the build with a message about staleness, which reads like
an infrastructure problem and is not. GitHub Actions does **not** run this check; only
Jenkins does.

Because the document is gitignored, that stage still has no input on a fresh checkout, and
it still **cannot** wait for the backend stage — the two run in parallel in one shared
workspace. So Preflight produces it, now simply by building the backend.

`.claude/hooks/guard-generated-files.mjs` denies edits to both the export and the generated
client, and `.claude/hooks/session-start.mjs` reports when the working tree is mid-chain —
which it decides from the **client** alone (API modified, client not), since the export can
never appear in `git status`.

## A change to `info.description` alone rewrites every generated file

The chain is not only about endpoints and schemas. orval copies the OpenAPI document's
`info.description` into the header comment of **every** file it emits:

```
/**
 * Generated by orval v8.20.0 🍺
 * Do not edit manually.
 * StigVidd
 * <info.description lands here>
 * OpenAPI spec version: 1.0.0
 */
```

Measured: adding a one-line `config.Description` to `AddOpenApiDocument` in `Program.cs`
produced a one-line change in `web/openapi.json` and a one-line diff in **every** file under
`web/src/api/generated/`. Nothing about the client's behaviour changed. There are **125** of
those files as of 2026-09-19 (104 of them under `model/`); older notes say 88, which was
true when they were written.

So a purely documentational edit to the API description still runs the whole chain and still
obliges a 125-file commit. Worth knowing before assuming a description-only change is free,
and worth saying in the commit message so the diff does not read as an accident.

## One thing the export dropped, deliberately

The old snapshot was taken over HTTP, so the middleware baked the test host's address into
it:

```json
"servers": [ { "url": "http://localhost" } ]
```

The exported document has no `servers` block. Measured, that is the *only* difference
between the two, and orval's output is byte-identical either way — the client goes through
`web/src/api/mutator.ts`, which builds its own URL from `VITE_API_URL`.

Related: [[codegen-runs-on-build-except-where-it-cannot]],
[[openapi-snapshot-fails-on-windows-line-endings]], [[diff-exit-code-pathspec-fails-open]],
[[agent-harness-hooks]], [[integration-tests-inherit-api-config]].
