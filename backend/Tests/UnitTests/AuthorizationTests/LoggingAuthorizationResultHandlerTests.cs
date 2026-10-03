// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Security.Claims;
using AwesomeAssertions;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authorization.Infrastructure;
using Microsoft.AspNetCore.Authorization.Policy;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Routing.Patterns;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using StigviddAPI.Authorization;

namespace UnitTests.AuthorizationTests;

public class LoggingAuthorizationResultHandlerTests
{
    private const string AdminRole = "stigvidd-admin";
    private const string RouteTemplate = "api/v1/admin/users/{identifier}/ban";

    private static (DefaultHttpContext Context, Mock<IAuthenticationService> Authentication) SignedInContext()
    {
        var authentication = new Mock<IAuthenticationService>();
        var context = new DefaultHttpContext
        {
            RequestServices = new ServiceCollection()
                .AddSingleton(authentication.Object)
                .BuildServiceProvider(),
            User = new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(ClaimTypes.NameIdentifier, "keycloak-sub-1")], "Bearer")),
        };
        context.Request.Method = "POST";
        context.SetEndpoint(new RouteEndpoint(
            _ => Task.CompletedTask,
            RoutePatternFactory.Parse(RouteTemplate),
            0,
            EndpointMetadataCollection.Empty,
            "test"));

        return (context, authentication);
    }

    private static AuthorizationPolicy AdminPolicy() =>
        new AuthorizationPolicyBuilder().RequireRole(AdminRole).Build();

    [Fact]
    public async Task Forbidden_LogsWhoWasDeniedWhereAndWhy()
    {
        // Arrange
        var logger = new RecordingLogger<LoggingAuthorizationResultHandler>();
        var (context, _) = SignedInContext();
        var result = PolicyAuthorizationResult.Forbid(
            AuthorizationFailure.Failed([new RolesAuthorizationRequirement([AdminRole])]));

        // Act
        await new LoggingAuthorizationResultHandler(logger).HandleAsync(_ => Task.CompletedTask, context, AdminPolicy(), result);

        // Assert
        var entry = logger.Entries.Should().ContainSingle().Subject;
        entry.Level.Should().Be(LogLevel.Warning);
        entry.Values["SubjectId"].Should().Be("keycloak-sub-1");
        entry.Values["Method"].Should().Be("POST");
        entry.Values["Endpoint"].Should().Be(RouteTemplate);
        entry.Values["FailedRequirements"].Should().BeOfType<string>().Which.Should().Contain(AdminRole);
    }

    [Fact]
    public async Task Forbidden_StillForbidsThroughTheFrameworkHandler()
    {
        // Arrange
        var (context, authentication) = SignedInContext();
        var nextRan = false;
        var result = PolicyAuthorizationResult.Forbid(
            AuthorizationFailure.Failed([new RolesAuthorizationRequirement([AdminRole])]));

        // Act
        await new LoggingAuthorizationResultHandler(new RecordingLogger<LoggingAuthorizationResultHandler>())
            .HandleAsync(_ => { nextRan = true; return Task.CompletedTask; }, context, AdminPolicy(), result);

        // Assert
        nextRan.Should().BeFalse();
        authentication.Verify(
            a => a.ForbidAsync(context, It.IsAny<string?>(), It.IsAny<AuthenticationProperties?>()),
            Times.Once);
    }

    [Fact]
    public async Task Success_RunsTheEndpointAndLogsNothing()
    {
        // Arrange
        var logger = new RecordingLogger<LoggingAuthorizationResultHandler>();
        var (context, _) = SignedInContext();
        var nextRan = false;

        // Act
        await new LoggingAuthorizationResultHandler(logger)
            .HandleAsync(_ => { nextRan = true; return Task.CompletedTask; }, context, AdminPolicy(), PolicyAuthorizationResult.Success());

        // Assert
        nextRan.Should().BeTrue();
        logger.Entries.Should().BeEmpty();
    }
}
