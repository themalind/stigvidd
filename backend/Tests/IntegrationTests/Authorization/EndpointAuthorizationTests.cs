using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;

namespace IntegrationTests.Authorization;

/// <summary>
/// Program.cs sets a FallbackPolicy so an endpoint without authorization metadata
/// requires a signed-in caller. These tests keep that from being undone by accident:
/// the first pins the list of deliberately public endpoints, the second insists every
/// other endpoint names its policy instead of leaning on the fallback.
/// </summary>
public class EndpointAuthorizationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    private static readonly string[] ApprovedAnonymousEndpoints =
    [
        // Browsing trails, facilities and obstacle reports works signed out — the app
        // shows the map before anyone logs in. "cards" is a batched read despite POST.
        "GET /api/v1/CityAreas",
        "GET /api/v1/CityAreas/{identifier}",
        "GET /api/v1/Facilities",
        "GET /api/v1/Facilities/{identifier}",
        "GET /api/v1/Reviews/trail/{trailIdentifier}",
        "GET /api/v1/TrailObstacles/issue-types",
        "GET /api/v1/TrailObstacles/trail/{trailIdentifier}",
        "GET /api/v1/Trails",
        "GET /api/v1/Trails/markers",
        "GET /api/v1/Trails/popular",
        "GET /api/v1/Trails/{identifier}",
        "GET /api/v1/Trails/{identifier}/card",
        "GET /api/v1/Trails/{identifier}/coordinates",
        "POST /api/v1/Trails/cards",

        // Signing up and recovering a password happen before there is a token.
        "POST /api/v1/Account/forgot-password",
        "POST /api/v1/Account/register",

        // Probes. Reached before anything is signed in and by design: healthz answers
        // liveness only and readyz runs the checks tagged ready, neither returns data.
        "* /healthz",
        "* /readyz",

        // Mapped only in Development, which is the environment the test host runs in.
        "GET /openapi/{documentName}.json",
    ];

    public EndpointAuthorizationTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public void AnonymousEndpoints_ShouldBeExactlyTheApprovedOnes()
    {
        // Act
        var anonymous = Endpoints()
            .Where(endpoint => endpoint.Metadata.GetMetadata<IAllowAnonymous>() is not null)
            .Select(Describe)
            .OrderBy(description => description, StringComparer.Ordinal);

        // Assert
        anonymous.Should().BeEquivalentTo(ApprovedAnonymousEndpoints);
    }

    [Fact]
    public void ProtectedEndpoints_ShouldNameAPolicy()
    {
        // Act — endpoints that are neither public nor explicitly gated only survive
        // because of the fallback, which exists to catch mistakes, not to be relied on.
        var unpolicied = Endpoints()
            .Where(endpoint => endpoint.Metadata.GetMetadata<IAllowAnonymous>() is null)
            .Where(endpoint => !endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>()
                .Any(data => !string.IsNullOrEmpty(data.Policy)))
            .Select(Describe)
            .OrderBy(description => description, StringComparer.Ordinal);

        // Assert
        unpolicied.Should().BeEmpty();
    }


    [Fact]
    public async Task UserPolicy_WhenTheRoleIsConfigured_ShouldRejectCallersWithoutIt()
    {
        // Arrange — stand in for the Keycloak realm role once it exists.
        using var factory = _factory.WithWebHostBuilder(builder =>
            builder.UseSetting("Authorization:UserRole", "stigvidd-user"));

        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", "firebase-uid-12346");

        // Act
        var withoutRole = await client.GetAsync("/api/v1/hikes", TestContext.Current.CancellationToken);

        client.DefaultRequestHeaders.Add("X-Test-Roles", "stigvidd-user");
        var withRole = await client.GetAsync("/api/v1/hikes", TestContext.Current.CancellationToken);

        // Assert
        withoutRole.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        withRole.StatusCode.Should().NotBe(HttpStatusCode.Forbidden);
    }
    private IEnumerable<RouteEndpoint> Endpoints() =>
        _factory.Services
            .GetRequiredService<IEnumerable<EndpointDataSource>>()
            .SelectMany(source => source.Endpoints)
            .OfType<RouteEndpoint>();

    private static string Describe(RouteEndpoint endpoint)
    {
        var methods = endpoint.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods;
        var verb = methods is { Count: > 0 } ? string.Join("|", methods.Order()) : "*";

        return $"{verb} /{endpoint.RoutePattern.RawText?.TrimStart('/')}";
    }
}
