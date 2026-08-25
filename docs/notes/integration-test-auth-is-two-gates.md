# An integration test's 401 can come from the controller, not from authorization

`StigViddWebApplicationFactory.ConfigureClient` puts `Authorization: Test` — the scheme
name with **no parameter** — on every client it creates. `TestAuthHandler` requires the
header to start with `"Bearer "`, so that default header *fails* authentication. A client
is only signed in once the test overwrites the header with `Bearer {firebaseUid}`.

That is the first gate. The second is the controller: several actions call
`GetAuthenticatedUserAsync` and `return Unauthorized("User not found")` when the uid has no
row — `HikesController.GetHikes` is one. `EndpointAuthorizationTests` holds no seeded data
(it takes the factory as a class fixture and never calls `SeedDatabase`), so a *correctly
authenticated* caller still gets **401 from the action body**.

Both gates answer 401, and an assertion over `HttpStatusCode` cannot tell them apart. That
is how `UserPolicy_WhenTheRoleIsConfigured_ShouldRejectCallersWithoutIt` passed while
proving nothing: it asserted `NotBe(Forbidden)` on both branches, and both branches were
401 the whole time. It would have stayed green no matter what the `"User"` policy required.

**Assert on the policy, not over HTTP**, when the thing under test is the policy:

```csharp
var policy = await _factory.Services
    .GetRequiredService<IAuthorizationPolicyProvider>().GetPolicyAsync("User")
    ?? throw new InvalidOperationException("The \"User\" policy is not registered.");

var result = await _factory.Services
    .GetRequiredService<IAuthorizationService>()
    .AuthorizeAsync(principal, resource: null, policy);
```

A `ClaimsIdentity` built with an authentication type is signed in; a bare `new
ClaimsIdentity()` is not. Over HTTP, reach for an endpoint whose action does not look the
caller up, or seed the user first.
