# On Windows `OpenApiContractTests` fails on a clean checkout, and the "contract change" is only CR bytes

[`OpenApiContractTests.OpenApiDocument_MatchesTheCommittedSnapshot`](../../backend/Tests/IntegrationTests/OpenApiContract/OpenApiContractTests.cs)
compares the live `/swagger/v1/swagger.json` against `web/openapi.json` with
`string.Equals(..., StringComparison.Ordinal)` — a byte-for-byte comparison, on a file
`.gitattributes` keeps at **LF** and a served document that on Windows is serialized with
**CRLF**. The two can never be equal there.

So on Windows the test fails on every run that starts from a clean working tree, even when
nothing about the API changed. Per the note it rewrites the snapshot first, so:

- run 1 fails and leaves `web/openapi.json` modified (now CRLF);
- run 2 is green, because it now compares CRLF against CRLF;
- `git checkout -- web/openapi.json` puts LF back, and run 3 fails again.

## Why it reads like a real contract change and is not

`git status` reports the file modified while `git diff` prints **nothing but a CRLF
warning**: git normalises line endings for the comparison, so a snapshot that differs only
in CR bytes shows an empty diff. A session that trusts the failure message goes looking for
the API change it announced, and there isn't one.

Measured 2026-08-31, after a change to `AccountController` that added no response type:

```sh
git show HEAD:web/openapi.json > /tmp/head.json    # 129885 bytes
# after the test rewrote it                         # 135336 bytes
diff <(tr -d '\r' < /tmp/head.json) <(tr -d '\r' < web/openapi.json)   # empty
```

5451 extra bytes, 5451 CRs, zero content difference.

**How to tell the two apart before debugging anything:** strip CR from both and diff. An
empty result means the contract is unchanged and the failure is this artifact — restore the
file with `git checkout -- web/openapi.json` and move on. A non-empty result is a real
contract change, and then the chain in [[openapi-contract-snapshot]] applies: review the
diff, `cd web && npm run generate:api`, commit both.

Linux and CI are unaffected — the document is serialized with LF there, so the comparison
matches and the test only fails when the contract really moved. That is also why nothing
catches this: it is invisible on the machines that gate the build.

Related: [[openapi-contract-snapshot]], [[line-endings-and-generated-files]].
