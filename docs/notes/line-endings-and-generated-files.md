# No .gitattributes + a generated-file diff gate = a red build that is only line endings

Two facts that are harmless separately:

1. This repo had **no `.gitattributes`**, and four tracked files are committed with CRLF
   and a UTF-8 BOM:
   `20260523120007_PostGIS.cs`, `20260523120007_PostGIS.Designer.cs`,
   `20260523125111_PostGIS_Path.cs`, `20260523125111_PostGIS_Path.Designer.cs`.
2. **Git for Windows defaults `core.autocrlf=true`**, so a Windows checkout of a repo with
   no `.gitattributes` gets CRLF in the working tree for everything.

Put them together with the Jenkinsfile `web` stage, which regenerates the typed client and
then runs

```sh
git diff --exit-code -- src/api/generated
```

and a Windows contributor who runs `npm run generate:api` gets a diff on **every** generated
file: orval writes LF, the checkout expects CRLF. The build fails with "the generated API
client is stale", which is a true sentence about a false problem, and the fix has nothing
to do with the API. The same shape applies to `app/`'s `prettier --check`, which is CI's
`format:check` step.

`.gitattributes` now declares `* text=auto eol=lf` plus explicit binary rules, so the
working tree is LF everywhere and the two checks mean the same thing on every platform.
The four CRLF+BOM files above were normalised in a separate commit, so the churn is not
tangled with anything else.

Anything that compares file content in this repo should still be newline-agnostic —
`.claude/hooks/lib.mjs` `lines()` exists for that.

Related: [[openapi-contract-snapshot]], [[agent-harness-hooks]].
