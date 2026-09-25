// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using StigviddAPI;
using StigviddAPI.Authorization;

namespace IntegrationTests.Authorization;

/// <summary>
/// A ban is read-only, and BannedUserWriteFilter refuses every write that is not marked
/// [AllowWhenBanned]. That default fails closed, so the risk is the opposite one: a mark
/// added to an endpoint that does reach other people. This pins the complete list.
/// </summary>
public class BannedUserWriteTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    private static readonly string[] ApprovedWritesWhileBanned =
    [
        // Their own account, their own lists, their own hike log. None of it reaches anyone
        // else, and a banned user is still entitled to leave and to take their data with them.
        "DELETE /api/v1/Users/delete",
        "DELETE /api/v1/Users/favorites/{trailIdentifier}",
        "DELETE /api/v1/Users/wishlist/{trailIdentifier}",
        "POST /api/v1/Users/create",
        "POST /api/v1/Users/favorites",
        "POST /api/v1/Users/wishlist",
        "DELETE /api/v1/Hikes/{hikeIdentifier}",
        "POST /api/v1/Hikes",

        // Push tokens are plumbing: the device registers one on every start, and a banned
        // account still gets the notifications it is subscribed to.
        "DELETE /api/v1/Notifications/tokens/{expoToken}",
        "POST /api/v1/Notifications/tokens",

        // Taking something back is always allowed. Deleting their own review or obstacle is
        // how a banned user complies with what the ban was for.
        "DELETE /api/v1/Reviews/{reviewIdentifier}",
        "DELETE /api/v1/TrailObstacles/solve/{trailObstacleIdentifier}",
        "DELETE /api/v1/TrailObstacles/{trailObstacleIdentifier}",

        // Blocking, unblocking and walking away from a connection protect the banned user
        // themselves, and reach the other person only by removing something.
        "DELETE /api/v1/Friends/blocks/{identifier}",
        "DELETE /api/v1/Friends/reject/{otherIdentifier}",
        "DELETE /api/v1/Friends/{friendIdentifier}",
        "POST /api/v1/Friends/blocks/{identifier}",

        // Answering a share already sent to them, and dropping one.
        "DELETE /api/v1/HikeShareRecipient/reject/{hikeIdentifier}",
        "DELETE /api/v1/HikeShareRecipient/{hikeIdentifier}",
        "PUT /api/v1/HikeShareRecipient/accept/{hikeIdentifier}",

        // Reporting reaches a moderator rather than the public, and a banned account is as
        // likely as any other to be the one seeing something that needs reporting.
        "POST /api/v1/ContentReports",

        // Signing up, verifying and recovering a password. Anonymous anyway, so the filter
        // never reaches them, but a banned user changing their own password must not depend
        // on that.
        "POST /api/v1/Account/reset-password",
        "POST /api/v1/Account/forgot-password",
        "POST /api/v1/Account/register",
        "POST /api/v1/Account/resend-verification",
        "POST /api/v1/Account/verify-email",

        // A batched read that happens to be a POST.
        "POST /api/v1/Trails/cards",
    ];

    public BannedUserWriteTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public void WritesAllowedWhileBanned_ShouldBeExactlyTheApprovedOnes()
    {
        // Act
        var allowed = Endpoints()
            .Where(endpoint => endpoint.Metadata.GetMetadata<AllowWhenBannedAttribute>() is not null)
            .Where(endpoint => !IsReadOnly(endpoint))
            .Select(Describe)
            .OrderBy(description => description, StringComparer.Ordinal);

        // Assert
        allowed.Should().BeEquivalentTo(ApprovedWritesWhileBanned.OrderBy(route => route, StringComparer.Ordinal));
    }

    private IEnumerable<RouteEndpoint> Endpoints() =>
        _factory.Services
            .GetRequiredService<IEnumerable<EndpointDataSource>>()
            .SelectMany(source => source.Endpoints)
            .OfType<RouteEndpoint>();

    // GET-only endpoints are never the filter's business, so a mark on one says nothing.
    private static bool IsReadOnly(RouteEndpoint endpoint)
    {
        var methods = endpoint.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods;

        return methods is { Count: > 0 } && methods.All(method => method is "GET" or "HEAD" or "OPTIONS" or "TRACE");
    }

    private static string Describe(RouteEndpoint endpoint)
    {
        var methods = endpoint.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods;
        var verb = methods is { Count: > 0 } ? string.Join("|", methods.Order()) : "*";

        return $"{verb} /{endpoint.RoutePattern.RawText?.TrimStart('/')}";
    }
}
