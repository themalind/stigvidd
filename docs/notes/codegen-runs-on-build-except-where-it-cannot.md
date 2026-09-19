# Code generation runs on an ordinary build — and the four places it deliberately does not

`web/openapi.json` and `web/src/api/generated` are refreshed by ordinary build commands:

| you run | what regenerates | wired via |
| --- | --- | --- |
| `cd backend && dotnet build` | `web/openapi.json` | `StigviddAPI.csproj`, target `GenerateOpenApiSpec` |
| VS Code **build api** task, or F5 | same | that task is the launch config's `preLaunchTask` |
| `cd web && npm run dev` | the document, then the client | `predev` → `web/scripts/codegen.mjs` |
| `cd web && npm run build` | same | `prebuild` → the same script |
| `cd web && npm run generate:api` | the client only | unchanged, and still the explicit form |

That is the point of the design: the contract is current in `git status` while you are still
working, instead of arriving as a red Jenkins build days later.

## Four environments run those same commands and must NOT generate

Each is detected differently, and the difference matters — two are **structural** (the files
needed are genuinely not there) and two need an **explicit flag**, because the structural
check would pass and the generation would then fail for an unrelated reason.

| context | excluded by | why it would otherwise break |
| --- | --- | --- |
| `backend/Dockerfile` | `Configuration == Debug`, plus an `Exists()` guard on the script | publishes in Release, build context `./backend` — there is no `../web` and no `../scripts` in the image |
| `web/Dockerfile` | structural check in `web/scripts/codegen.mjs`: no `../scripts/generate-openapi.mjs` | build context `./web` on `node:24-alpine` — no monorepo, no dotnet |
| GitHub CI `web` job | `STIGVIDD_SKIP_API_CODEGEN: "true"` in the job env | a **full checkout**, so the structural check passes — but the runner has no .NET SDK, and `npm run build` would die on a missing `dotnet` |
| Jenkins `web` stage | the same flag, on the stage | Preflight already exported the document and the stage regenerates the client explicitly before diffing it; running it again is a wasted host boot |

The GitHub row is the one that is easy to get wrong. "It is the same repository, so the
script is there" is true and irrelevant: what is missing is the *toolchain*, and nothing
about the checkout says so.

## Two more states that are not failures

- **The backend is not built.** `web`'s hook calls the generator with `--if-built`, which
  says so and exits 0. A web build must not fail because another area has not been compiled
  — nothing else here makes one area's build depend on another's.
- **There is no `web/openapi.json` at all.** The file is gitignored, so a fresh clone has
  none. `codegen.mjs` skips orval and the committed client is used, which is correct: that
  client was generated from this same API by whoever committed it.

## The MSBuild target's conditions are all load-bearing

```xml
Condition="'$(Configuration)' == 'Debug'
       And '$(DesignTimeBuild)' != 'true'
       And '$(StigviddSkipApiCodegen)' != 'true'
       And Exists('$(MSBuildProjectDirectory)/../../scripts/generate-openapi.mjs')"
Inputs="$(TargetPath)"
Outputs="$(MSBuildProjectDirectory)/../../web/openapi.json"
```

`DesignTimeBuild` is the non-obvious one: the C# Dev Kit runs design-time builds constantly
while you type, and without that condition the editor would boot the API host on every one.

`Inputs`/`Outputs` make it incremental — MSBuild prints *"Skipping target
"GenerateOpenApiSpec" because all output files are up-to-date"* on a no-op rebuild. That is
also why `scripts/generate-openapi.mjs` **always writes** the file even when the content is
identical: leaving it untouched would keep it older than the assembly and boot the host
again on every single build.

`ContinueOnError="true"` (MSBuild's synonym for `WarnAndContinue`) means a failed export
warns rather than failing `dotnet build`. The hard assertion lives in the Jenkinsfile
Preflight, which checks `[ ! -s web/openapi.json ]` — that is where a missing document
actually matters, because the web stage cannot run without it.

Two things a reader trips over:

- The comment block in the csproj cannot contain `--`. XML forbids it, so
  `--export-openapi` had to be spelled without the dashes; `dotnet build` fails with
  `MSB4025: An XML comment cannot contain '--'` rather than anything about the target.
- `node_modules/.bin/orval` is a **shim, not an executable**, so `codegen.mjs` spawns
  `node_modules/orval/dist/bin/orval.mjs` directly. Same rule as the hooks — see
  [[agent-harness-hooks]].

Related: [[openapi-contract-snapshot]], [[agent-harness-hooks]],
[[diff-exit-code-pathspec-fails-open]], [[line-endings-and-generated-files]].
