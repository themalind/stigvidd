// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using StigviddAPI;

namespace IntegrationTests.Authorization;

/// <summary>
/// Program.cs sets a FallbackPolicy so an endpoint without authorization metadata
/// requires a signed-in caller. These tests keep that from being undone by accident:
/// the first pins the list of deliberately public endpoints, the second insists every
/// other endpoint is gated by an attribute of its own instead of leaning on the
/// fallback, and the third pins which of them are behind the realm's only role.
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

    private static readonly string[] ApprovedAdminEndpoints =
    [
        // Curated content: trails and facilities are ours to write, and their images
        // with them. Reading any of it is anonymous, so only the writes appear here.
        "DELETE /api/v1/Facilities/images/{imageIdentifier}",
        "DELETE /api/v1/Facilities/{identifier}",
        "DELETE /api/v1/Trails/images/{imageIdentifier}",
        "POST /api/v1/Facilities",
        "POST /api/v1/Facilities/{identifier}/images",
        "POST /api/v1/Trails/create",
        "POST /api/v1/Trails/{identifier}/images",
        "POST /api/v1/Trails/{identifier}/symbol",
        "PUT /api/v1/Facilities/update/{identifier}",
        "PUT /api/v1/Trails/{identifier}",

        // The media library is the whole upload store, reads included.
        "GET /api/v1/Media",
        "PATCH /api/v1/Media/{imageIdentifier}",

        // export hands out the database, the media volume and the Keycloak realm;
        // import replaces this host's data.
        "GET /api/v1/admin/export",
        "POST /api/v1/admin/import",

        // The Boras sync, gated at the class.
        "DELETE /api/v1/admin/trail-import/sessions/{id:int}",
        "GET /api/v1/admin/trail-import/sessions",
        "GET /api/v1/admin/trail-import/sessions/{id:int}",
        "GET /api/v1/admin/trail-import/sessions/{id:int}/diff",
        "GET /api/v1/admin/trail-import/sessions/{id:int}/proposals",
        "GET /api/v1/admin/trail-import/sessions/{id:int}/proposals/{proposalId:int}/preview",
        "GET /api/v1/admin/trail-import/vocabulary",
        "POST /api/v1/admin/trail-import/sessions",
        "POST /api/v1/admin/trail-import/sessions/{id:int}/analyze",
        "POST /api/v1/admin/trail-import/sessions/{id:int}/apply",
        "POST /api/v1/admin/trail-import/sessions/{id:int}/decide-bulk",
        "POST /api/v1/admin/trail-import/sessions/{id:int}/proposals/{proposalId:int}/decide",
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
    public void ProtectedEndpoints_ShouldCarryTheirOwnAuthorizationMetadata()
    {
        // Act — an endpoint that is neither public nor gated by an attribute of its own
        // survives only because of the fallback, which exists to catch mistakes, not to
        // be relied on. A bare [Authorize] counts: the realm has one role, so "signed in"
        // is the whole requirement and names no policy.
        var ungated = Endpoints()
            .Where(endpoint => endpoint.Metadata.GetMetadata<IAllowAnonymous>() is null)
            .Where(endpoint => !endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>().Any())
            .Select(Describe)
            .OrderBy(description => description, StringComparer.Ordinal);

        // Assert
        ungated.Should().BeEmpty();
    }

    [Fact]
    public void AdminEndpoints_ShouldBeExactlyTheApprovedOnes()
    {
        // Act — "Admin" is the only policy left, so the set of endpoints naming one is
        // the set gated on the realm's only role. Pinning it means an attribute lost in
        // an edit shows up here rather than in production.
        var admin = Endpoints()
            .Where(endpoint => endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>()
                .Any(data => data.Policy == "Admin"))
            .Select(Describe)
            .OrderBy(description => description, StringComparer.Ordinal);

        // Assert
        admin.Should().BeEquivalentTo(ApprovedAdminEndpoints);
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
