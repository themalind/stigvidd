---
name: add-an-endpoint
description: Add or change a backend HTTP endpoint (StigviddAPI/Controllers) — a new route, a changed request/response shape, a new service or repository behind one. Use BEFORE writing the controller action, and whenever an endpoint you added returns 500 at runtime, is missing from the web client, or its validator never runs. Covers the two silent registration points and the contract chain the change obliges.
---

# Adding an endpoint

Two things make this more than "write a controller action": one registration point that
fails at **runtime** rather than at compile time, and a generated client that goes stale
without saying so.

## The shape

```
StigviddAPI/Controllers/XsController.cs     [ApiController], [Route("api/v1/[controller]")], : StigViddController
WebDataContracts/RequestModels/X/           the request DTO
WebDataContracts/ResponseModels/X/          the response DTO — this is the WIRE CONTRACT
Core/Interfaces/Services/IXService.cs
Core/Services/XService.cs                   returns Result<T> / RepositoryResult<T>
Core/Interfaces/Repositories/IXRepository.cs
Core/Repositories/XRepository.cs            EF queries; ordering and scoring live HERE
Core/Factories/XResponseFactory.cs          entity -> response
Core/Validators/X/XRequestValidator.cs      FluentValidation
```

Conventions worth matching rather than reinventing: every async method takes
`CancellationToken ctoken` as its last parameter; controllers stay thin and translate a
failed `Result` with the inherited `ToActionResult(result.Message)`; an authenticated
action gets the caller via `GetAuthenticatedUserAsync(_userService, ctoken)` from
`StigViddController` and returns `Unauthorized(...)` on null.

## Step 1 — the registration that fails at runtime

**Every service and repository must be added by hand to
[`Core/ServiceCollectionExtensions.cs`](../../../backend/Core/ServiceCollectionExtensions.cs):**

```csharp
services.AddTransient<IXRepository, XRepository>();
services.AddTransient<IXService, XService>();
```

Forget it and nothing fails to compile. The controller's constructor injection throws at
request time — or at `WebApplicationFactory` startup, which makes the *whole integration
suite* red with a DI message that names a type, not your omission. Transient is the default
here by convention (the comment in that file explains why: widening a lifetime later is
easier than narrowing one).

**Validators are the opposite** and this asymmetry is the trap. `Program.cs` calls
`AddValidatorsFromAssemblyContaining<AddToUserFavoriteValidator>()`, so a validator in
`Core/Validators/` is registered by *existing there* — and a validator placed in any other
assembly is silently never called. There is no error; the request simply is not validated.

## Step 2 — the contract chain, which you have now obliged

Any change to `Controllers/` or `WebDataContracts/` changes the OpenAPI document, and:

1. `cd backend && ConnectionStrings__StigVidd="DataSource=:memory:" dotnet test --no-build`
2. **It fails, once, by design.** `OpenApiContractTests` overwrites `web/openapi.json` with
   the new document and calls `Assert.Fail`.
3. Read the diff of `web/openapi.json`. This is the moment to notice that a DTO you thought
   was internal is now on the wire, or that a nullable slipped.
4. `cd web && npm run generate:api`
5. Re-run the backend tests (green now) and commit **both** files.

Skipping 4 leaves the typed client stale. GitHub Actions will not catch it — only the
Jenkinsfile `web` stage runs `git diff --exit-code -- src/api/generated`, and it reports it
as "the generated API client is stale", which reads like an infrastructure problem.
Full detail: [openapi-contract-snapshot](../../../docs/notes/openapi-contract-snapshot.md).

## Step 3 — authorization, deliberately

`[Authorize]` for "a signed-in user", and the `"Admin"` policy (registered in `Program.cs`
as `RequireRole(adminRole)`, with Keycloak realm roles mapped by
`Authorization/KeycloakRealmRolesTransformation.cs`) for admin-only. An endpoint with no
attribute is **anonymous** — decide that, do not default into it.

## Step 4 — the test pair

- **Unit** (`Tests/UnitTests/ServiceTests`, `RepositoryTests`, `FactoryTests`,
  `ValidatorTests`) — EF InMemory, Moq for collaborators.
- **Integration** (`Tests/IntegrationTests/<Xs>Controller/`) — the real host over SQLite +
  SpatiaLite, which is what proves the route, the model binding, the validator and the
  authorization actually line up.

Then run [prove-it-bites](../prove-it-bites/SKILL.md) on the new assertions. An integration
test that passed first try is equally consistent with the route never being hit.

## If the endpoint carries geometry

Read [srid-4326](../../../docs/notes/srid-4326.md) first. A `Point` built without
`.WithSRID(4326)` is SRID 0, the type system says nothing, and SpatiaLite and PostGIS
disagree about what happens next — so the same omission can be green in the test suite and
broken in production, or the reverse.
