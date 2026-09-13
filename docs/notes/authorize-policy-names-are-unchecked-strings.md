# An Authorize policy name that `AddPolicy` never registered is a 500 at request time, not a startup error

ASP.NET Core does not resolve policy names at startup. `AddAuthorization` builds a
registry, `[Authorize(Policy = "X")]` is a **string** looked up per request, and a miss
throws `InvalidOperationException: The AuthorizationPolicy named: 'X' was not found.`
inside `AuthorizationMiddleware`. So the endpoint returns **500**, and it does so *before*
evaluating authentication — the caller gets 500 whether or not they hold the role, and
whether or not they sent a token at all.

That is the exact inverse of the failure an authorization change is trying to prevent, and
nothing in the build objects: `Program.cs` compiles, every controller compiles, and the app
starts clean.

Measured on `feature/204`: the branch moved the admin surface to
[`StigviddAPI/Controllers/Admin/`](../../backend/StigviddAPI/Controllers/Admin/) and wrote
`[Authorize(Policy = "AdminOnly")]` on all of it, while
[`Program.cs`](../../backend/StigviddAPI/Program.cs) still registered `"Admin"`. Every route
under `api/v1/admin/*` would have answered 500.

## Two things hid it, and both are worth knowing

**1. The test that would have caught it could not run.** Four new test files carried
`using FluentAssertions;` after the repo had moved to `AwesomeAssertions`, whose namespace
really is renamed ([[fluentassertions-8-is-not-free-software]]). `backend/Tests` did not
compile, so `dotnet test` reported a *build* failure and no assertion in either project ran.
A test suite that cannot compile is not a suite that passed — when the build breaks in the
test projects, nothing downstream of it has been checked, however green the last run was.

**2. The pinning test names the policy as a literal too.**
[`EndpointAuthorizationTests`](../../backend/Tests/IntegrationTests/Authorization/EndpointAuthorizationTests.cs)
filters endpoints with `data.Policy == "Admin"` and compares the result against a
`string[]` of approved routes. Rename the policy and that filter silently matches nothing,
so the assertion reports **"expected a collection with 37 item(s), but found an empty
collection"** — naming no controller, no policy and no route. It reads like the endpoints
lost their attributes; in fact only the string moved. See
[[new-endpoint-must-be-added-to-the-authorization-allowlist]] for the same test's other trap.

## What actually pins it

Renaming a policy is a **three-place** edit, and only the first is obvious:

1. `options.AddPolicy("…")` in `Program.cs`;
2. every `[Authorize(Policy = "…")]` — `grep -rn 'Policy = "' backend --include=*.cs`
   lists them all, and it must come back uniform;
3. the `data.Policy == "…"` literal in `EndpointAuthorizationTests`.

The integration tests are what make the difference visible: asserting **403** for a
signed-in non-admin, rather than "not 200", is what separates a working policy from an
unregistered one, because an unregistered policy also fails to return 200. A test that only
checks the call was refused passes in both worlds.

Related: [[new-endpoint-must-be-added-to-the-authorization-allowlist]],
[[fluentassertions-8-is-not-free-software]].
