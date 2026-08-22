# The API contract is a one-way pipeline, and the test in the middle rewrites a file

The typed client the admin web uses is not written by hand. Three artifacts are chained,
and the arrow only points one way:

```
backend/StigviddAPI/Controllers/*.cs        the source of truth
backend/WebDataContracts/*.cs
        |  NSwag, at runtime, on /swagger/v1/swagger.json
        v
web/openapi.json                            a committed SNAPSHOT
        |  orval, `npm run generate:api` (web/orval.config.ts)
        v
web/src/api/generated/**                    react-query hooks + models
```

## The part that surprises a session

[`OpenApiContractTests`](../../backend/Tests/IntegrationTests/OpenApiContract/OpenApiContractTests.cs)
does not merely compare the live document against `web/openapi.json`. On a mismatch it
**overwrites the snapshot with the current document and then calls `Assert.Fail`**. So the
first backend test run after any API change:

- fails, with a message naming the file it just rewrote, and
- leaves `web/openapi.json` modified in your working tree.

That failure is **expected and is not a bug in your change**. The sequence is: run the
tests, read the diff of the rewritten snapshot to confirm the contract changed the way you
meant, then `cd web && npm run generate:api`, then commit *both* files. Running the tests a
second time is green because the snapshot now matches.

## The second gate, in Jenkins only

The Jenkinsfile `web` stage regenerates the client from the committed snapshot and then
runs `git diff --exit-code -- src/api/generated`. A stale client — or a hand edit under
`web/src/api/generated/` — fails the build with a message about staleness, which reads
like an infrastructure problem and is not. GitHub Actions does **not** run this check;
only Jenkins does.

`.claude/hooks/guard-generated-files.mjs` denies edits to both the snapshot and the
generated client, and `.claude/hooks/session-start.mjs` reports when the working tree is
mid-chain (API modified, snapshot not; or snapshot modified, client not).

Related: [[nullable-warnings-are-errors]], [[agent-harness-hooks]].
