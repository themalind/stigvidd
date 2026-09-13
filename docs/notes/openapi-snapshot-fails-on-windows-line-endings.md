# `OpenApiContractTests` used to fail on Windows over CR bytes alone — untracking the snapshot removed it

This was live while `web/openapi.json` was **committed**. It is not any more, and the
reason it is gone is worth as much as the trap was.

[`OpenApiContractTests.OpenApiDocument_MatchesTheGeneratedSnapshot`](../../backend/Tests/IntegrationTests/OpenApiContract/OpenApiContractTests.cs)
compares the live `/swagger/v1/swagger.json` against `web/openapi.json` with
`string.Equals(..., StringComparison.Ordinal)` — byte for byte. While the file was tracked,
`.gitattributes` kept it at **LF** while the document served on Windows is serialized with
**CRLF**, so the two could never be equal there:

- run 1 failed and left the file modified (now CRLF);
- run 2 was green, comparing CRLF against CRLF;
- `git checkout -- web/openapi.json` put LF back, and run 3 failed again.

Measured 2026-08-31, after a change to `AccountController` that added no response type:
129885 bytes became 135336 — 5451 extra bytes, 5451 CRs, **zero** content difference.
`git status` said modified while `git diff` printed only a CRLF warning, because git
normalises line endings for the comparison. A session that trusted the failure message went
looking for an API change that was not there.

## Why it cannot happen now

The snapshot is gitignored, so nothing forces it to LF and there is no `git checkout` that
can put LF back. A clean Windows checkout has **no** snapshot at all, and the test now
treats that as the normal case: it writes the file and passes. Every later run compares the
machine's own CRLF against CRLF. The comparison is still ordinal — it just no longer has a
foreign line ending to trip over.

## The part still worth keeping

The diagnosis generalises to any byte-exact comparison against a file git may normalise:
**strip CR from both sides and diff.** An empty result means the content is identical and
the difference is line endings; a non-empty one is a real change. If a byte-exact snapshot
is ever committed again, `.gitattributes` and the serializer have to agree, or this returns.

Related: [[openapi-contract-snapshot]], [[line-endings-and-generated-files]].
