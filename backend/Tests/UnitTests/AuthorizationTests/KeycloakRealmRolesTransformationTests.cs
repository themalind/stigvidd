// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using StigviddAPI.Authorization;
using System.Security.Claims;

namespace UnitTests.AuthorizationTests;

/// <summary>
/// The "AdminOnly" policy on every controller under api/v1/admin resolves through this
/// transformation in production. The integration tests inject role claims directly, so
/// without these the realm_access parsing could break and leave the suite green while
/// every admin endpoint returns 403.
/// </summary>
public class KeycloakRealmRolesTransformationTests
{
    private const string AdminRole = "stigvidd-admin";

    private static ClaimsPrincipal BuildPrincipal(string? realmAccess)
    {
        var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, "keycloak-sub") };

        if (realmAccess != null)
            claims.Add(new Claim("realm_access", realmAccess));

        return new ClaimsPrincipal(new ClaimsIdentity(claims, "Bearer"));
    }

    private static async Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal) =>
        await new KeycloakRealmRolesTransformation().TransformAsync(principal);

    [Fact]
    public async Task TransformAsync_WithRealmRoles_AddsThemAsRoleClaims()
    {
        // Arrange
        var principal = BuildPrincipal($"{{\"roles\":[\"{AdminRole}\",\"offline_access\"]}}");

        // Act
        var result = await TransformAsync(principal);

        // Assert
        result.IsInRole(AdminRole).Should().BeTrue();
        result.IsInRole("offline_access").Should().BeTrue();
    }

    [Fact]
    public async Task TransformAsync_WithoutTheAdminRole_LeavesThePolicyUnsatisfied()
    {
        // Arrange
        var principal = BuildPrincipal("{\"roles\":[\"offline_access\"]}");

        // Act
        var result = await TransformAsync(principal);

        // Assert
        result.IsInRole(AdminRole).Should().BeFalse();
    }

    [Fact]
    public async Task TransformAsync_WithoutTheRealmAccessClaim_AddsNoRoles()
    {
        // Arrange
        var principal = BuildPrincipal(null);

        // Act
        var result = await TransformAsync(principal);

        // Assert
        result.FindAll(ClaimTypes.Role).Should().BeEmpty();
    }

    [Theory]
    [InlineData("not json at all")]
    [InlineData("{\"roles\":")]
    public async Task TransformAsync_WithMalformedRealmAccess_LeavesThePrincipalUnchanged(string realmAccess)
    {
        // Arrange — a malformed claim must not throw out of the auth pipeline.
        var principal = BuildPrincipal(realmAccess);

        // Act
        var result = await TransformAsync(principal);

        // Assert
        result.FindAll(ClaimTypes.Role).Should().BeEmpty();
        result.FindFirst(ClaimTypes.NameIdentifier)!.Value.Should().Be("keycloak-sub");
    }

    [Fact]
    public async Task TransformAsync_WhenRolesIsNotAnArray_AddsNoRoles()
    {
        // Arrange
        var principal = BuildPrincipal($"{{\"roles\":\"{AdminRole}\"}}");

        // Act
        var result = await TransformAsync(principal);

        // Assert
        result.FindAll(ClaimTypes.Role).Should().BeEmpty();
    }

    [Fact]
    public async Task TransformAsync_RunTwice_DoesNotDuplicateRoleClaims()
    {
        // Arrange — ASP.NET Core can invoke IClaimsTransformation more than once per
        // request, and the transformation mutates the identity in place.
        var principal = BuildPrincipal($"{{\"roles\":[\"{AdminRole}\"]}}");

        // Act
        await TransformAsync(principal);
        var result = await TransformAsync(principal);

        // Assert
        result.FindAll(ClaimTypes.Role).Should().HaveCount(1);
        result.IsInRole(AdminRole).Should().BeTrue();
    }
}
