# When the defence is an allowlist, "this obfuscated attack is rejected" cannot fail — the test that bites asserts an obfuscated *legitimate* value is accepted

[`MailHtmlPolicy`](../../backend/Core/Services/MailHtmlPolicy.cs) decides whether an `href` is
acceptable by requiring one of `http: https: mailto: tel: cid:`. It also HTML-decodes the value
and strips control characters first, because `&#106;avascript:` and `java<TAB>script:` are both
`javascript:` to a browser.

Two tests were written for that decoding, named for it:

```csharp
AnEntityEncodedJavascriptScheme_IsStillRejected
ASchemeBrokenUpByAControlCharacter_IsStillRejected
```

Both **passed with the decode and the control-character strip deleted**. Measured, by removing
both lines and running the suite: `failed: 0`.

## Why they cannot fail

They assert the wrong direction. An allowlist rejects everything it does not recognise, so an
obfuscated `javascript:` is rejected *because it is not in the list* — not because anything saw
through the obfuscation. Undoing the deobfuscation makes the string **less** recognisable, so
it is still rejected, so the test still passes. The assertion is true for a reason that has
nothing to do with the code it is named after.

This is the shape to watch for: a decode/normalise/canonicalise step in front of an allowlist
can only ever move a value **towards** being accepted. So it is invisible to every rejection
test, and visible only to acceptance tests.

## The test that does bite

```csharp
AnEntityEncodedLegitimateScheme_IsAccepted          // href="&#104;ttps://stigvidd.se"
AControlCharacterInsideAnAllowedScheme_DoesNotCauseAFalseRejection   // "htt<TAB>ps://…"
```

Both go red the moment the decode is removed. The rejection tests were kept — an allowlist that
holds is worth pinning — but renamed to say what they actually demonstrate
(`AnObfuscatedDangerousScheme_IsRejectedByTheAllowlistRatherThanByRecognisingIt`), with the
measurement in the comment so nobody re-reads them as coverage of the decoding.

The same reasoning applies to the other allowlists here: `MailHtmlPolicy`'s tag and attribute
lists, `isSafeMailUrl` in [`web/src/lib/mail-template.ts`](../../web/src/lib/mail-template.ts),
and `ApprovedAnonymousEndpoints` / `ApprovedAdminEndpoints` in `EndpointAuthorizationTests`.
Adding a "we block X" test to any of them proves the list, never the parsing in front of it.

## The general form

A test whose assertion is satisfied by *doing less* is not testing the thing it is named for.
It is worth asking, of any new security-flavoured assertion: **which line of production code
would I delete to make this fail?** If the answer is "none — the fallback catches it anyway",
the test documents the fallback, and the code it was written for is still uncovered.

Found by following [`prove-it-bites`](../../.claude/skills/prove-it-bites/SKILL.md) on tests
that had gone green first try. Related: [[wysiwyg-over-operator-authored-html]] for the rest of
what that round of mutation testing turned up.
