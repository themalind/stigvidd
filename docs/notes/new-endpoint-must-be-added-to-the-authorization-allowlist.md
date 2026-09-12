# Adding an anonymous or admin endpoint fails a test that names neither your endpoint nor your file

`Tests/IntegrationTests/Authorization/EndpointAuthorizationTests.cs` pins the **complete** list
of endpoints that are reachable without a token, and the complete list behind the `"Admin"`
policy, as two `string[]` literals. It then enumerates the running host's endpoint data source
and asserts equality.

So adding one `[AllowAnonymous]` route — or one admin route — turns the suite red, and the
failure is a `BeEquivalentTo` collection diff reported against
`EndpointAuthorizationTests.cs`. It names the assertion, not your controller, and there is
nothing in the message to suggest the fix is "add your route to a list in a different file."

The fix is one line in the right array:

```csharp
"GET /api/v1/Account/verify-email",
```

Format is `"<METHOD> <route template>"`, with the controller name cased as the class is
(`Account`, not `account`), regardless of what casing the `[Route]` attribute or your test URLs
use. `*` is the method for an endpoint mapped outside MVC (`* /healthz`).

## Why the list is worth the friction

[`Program.cs`](../../backend/StigviddAPI/Program.cs) sets a `FallbackPolicy` requiring an
authenticated user, so forgetting an attribute fails **closed** — safe. The danger is the
opposite direction: `[AllowAnonymous]` written once and never reviewed again. These tests make
widening the public surface an explicit, reviewable diff, which is exactly what you want from
the three endpoints that must be anonymous because the account cannot log in yet
([[verification-gate-lives-in-keycloak-not-the-api]]).

## The skill does not mention it

[`.claude/skills/add-an-endpoint/SKILL.md`](../../.claude/skills/add-an-endpoint/SKILL.md)
Step 3 says to choose authorization deliberately — "An endpoint with no attribute is
**anonymous** — decide that, do not default into it" — and Step 4 describes the unit/integration
test pair to write. Neither says an **existing** test must be edited. Measured: following the
skill exactly produced a red suite with a failure pointing at a file the change never touched.

Related: [[verification-gate-lives-in-keycloak-not-the-api]].
