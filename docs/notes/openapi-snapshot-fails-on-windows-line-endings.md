# The OpenAPI document's line endings were a Windows trap twice, and are now pinned to LF

Two mechanisms have since removed this trap, and both are worth knowing, because the
underlying hazard returns the moment a byte-exact comparison meets a file git may normalise.

## What it was

While `web/openapi.json` was **committed**, `OpenApiContractTests` compared the live
`/swagger/v1/swagger.json` against it with `string.Equals(..., StringComparison.Ordinal)` —
byte for byte. `.gitattributes` kept the file at **LF**; the document served on Windows was
serialized with **CRLF**. The two could never be equal there:

- run 1 failed and left the file modified (now CRLF);
- run 2 was green, comparing CRLF against CRLF;
- `git checkout -- web/openapi.json` put LF back, and run 3 failed again.

Measured 2026-08-31, after a change to `AccountController` that added no response type:
129885 bytes became 135336 — 5451 extra bytes, 5451 CRs, **zero** content difference.
`git status` said modified while `git diff` printed only a CRLF warning, because git
normalises line endings for the comparison. A session that trusted the failure message went
looking for an API change that was not there.

## Why it cannot happen now

**Untracking the file removed the git half.** Nothing forces it to LF and there is no
`git checkout` that can put LF back.

**Removing the test removed the comparison.** The document is now exported by the build
(see [[openapi-contract-snapshot]]); nothing asserts it byte for byte any more.

**The export normalises anyway, and that is the part that still earns its place.** NSwag's
`OpenApiDocument.ToJson()` goes through Newtonsoft, which indents with
`Environment.NewLine` — so it is CRLF on Windows and LF everywhere else. `Program.cs`'s
`--export-openapi` branch replaces `\r\n` with `\n` before writing. Without that, the same
API would produce different bytes on a Windows box and a Linux box, and while the document
itself is gitignored, the **client generated from it is committed** and Jenkins diffs it.

## The part still worth keeping

The diagnosis generalises to any byte-exact comparison against a file git may normalise:
**strip CR from both sides and diff.** An empty result means the content is identical and
the difference is line endings; a non-empty one is a real change. If a byte-exact snapshot
is ever committed again, `.gitattributes` and the serializer have to agree, or this returns.

Related: [[openapi-contract-snapshot]], [[line-endings-and-generated-files]],
[[codegen-runs-on-build-except-where-it-cannot]].
