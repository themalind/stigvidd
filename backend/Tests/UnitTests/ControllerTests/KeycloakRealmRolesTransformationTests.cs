using FluentAssertions;
using StigviddAPI.Authorization;
using System.Security.Claims;

namespace UnitTests.ControllerTests;

/// <summary>
/// The whole point of the transformation is that RequireRole works afterwards, and
/// RequireRole reads the identity's own RoleClaimType. The Keycloak handler sets that to
/// "role", so a claim written under any other type is invisible to it — which is what
/// turned every admin endpoint into a 403. Asserted through IsInRole rather than by
/// looking for a claim, because IsInRole is what the policies actually call.
/// </summary>
public class KeycloakRealmRolesTransformationTests
{
    private const string AdminRole = "stigvidd-admin";

    private static ClaimsPrincipal Principal(string roleClaimType, string realmAccess)
    {
        var identity = new ClaimsIdentity(
            [new Claim("realm_access", realmAccess)],
            authenticationType: "Bearer",
            nameType: "preferred_username",
            roleType: roleClaimType);

        return new ClaimsPrincipal(identity);
    }

    private static Task<ClaimsPrincipal> Transform(ClaimsPrincipal principal) =>
        new KeycloakRealmRolesTransformation().TransformAsync(principal);

    [Theory]
    [InlineData("role")]              // what Keycloak.AuthServices configures
    [InlineData(ClaimTypes.Role)]     // the framework default
    public async Task TransformAsync_ForAnyRoleClaimType_ShouldMakeTheRealmRoleVisibleToIsInRole(string roleClaimType)
    {
        // Arrange
        var principal = Principal(roleClaimType, $$"""{"roles":["{{AdminRole}}","offline_access"]}""");

        // Act
        var transformed = await Transform(principal);

        // Assert
        transformed.IsInRole(AdminRole).Should().BeTrue();
        transformed.IsInRole("offline_access").Should().BeTrue();
        transformed.IsInRole("stigvidd-user").Should().BeFalse();
    }

    [Fact]
    public async Task TransformAsync_RunTwice_ShouldNotAddTheRoleAgain()
    {
        // Arrange — the transformation is a singleton and runs on every request against
        // the same identity, so it has to be idempotent.
        var principal = Principal("role", $$"""{"roles":["{{AdminRole}}"]}""");

        // Act
        await Transform(principal);
        var transformed = await Transform(principal);

        // Assert
        transformed.FindAll(claim => claim.Type == "role" && claim.Value == AdminRole).Should().HaveCount(1);
    }

    [Fact]
    public async Task TransformAsync_ForATokenWithoutRealmAccess_ShouldLeaveThePrincipalAlone()
    {
        // Arrange
        var principal = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim("preferred_username", "someone")], "Bearer", "preferred_username", "role"));

        // Act
        var transformed = await Transform(principal);

        // Assert
        transformed.IsInRole(AdminRole).Should().BeFalse();
        transformed.Claims.Should().ContainSingle();
    }

    [Fact]
    public async Task TransformAsync_ForAMalformedRealmAccessClaim_ShouldNotThrow()
    {
        // Arrange
        var principal = Principal("role", "not json at all");

        // Act
        var transforming = async () => await Transform(principal);

        // Assert
        await transforming.Should().NotThrowAsync();
    }
}
