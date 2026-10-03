// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Security.Claims;
using AwesomeAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Routing.Patterns;
using Microsoft.Extensions.Logging;
using StigviddAPI.Extensions;

namespace UnitTests.LoggingTests;

public class RequestLoggingMiddlewareTests
{
    private const string RouteTemplate = "api/v1/trails/{identifier}";
    private const string SubjectId = "keycloak-sub-1";

    private static DefaultHttpContext Context(
        string path = "/api/v1/trails/abc",
        string method = "GET",
        bool withEndpoint = true,
        string? subjectId = SubjectId)
    {
        var context = new DefaultHttpContext();
        context.Request.Method = method;
        context.Request.Path = path;
        context.Request.QueryString = new QueryString("?lat=59.3293&lon=18.0686");

        if (withEndpoint)
        {
            context.SetEndpoint(new RouteEndpoint(
                _ => Task.CompletedTask,
                RoutePatternFactory.Parse(RouteTemplate),
                0,
                EndpointMetadataCollection.Empty,
                "test"));
        }

        if (subjectId is not null)
        {
            context.User = new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(ClaimTypes.NameIdentifier, subjectId)], "Bearer"));
        }

        return context;
    }

    private static async Task<RecordingLogger<RequestLoggingMiddleware>> RunAsync(HttpContext context, int statusCode)
    {
        var logger = new RecordingLogger<RequestLoggingMiddleware>();
        var middleware = new RequestLoggingMiddleware(
            ctx =>
            {
                ctx.Response.StatusCode = statusCode;
                return Task.CompletedTask;
            },
            logger);

        await middleware.InvokeAsync(context);

        return logger;
    }

    [Fact]
    public async Task ServerError_LogsAWarningWithTheRouteTemplate()
    {
        // Act
        var logger = await RunAsync(Context(), 500);

        // Assert
        var entry = logger.Entries.Should().ContainSingle().Subject;
        entry.Level.Should().Be(LogLevel.Warning);
        entry.Values["Method"].Should().Be("GET");
        entry.Values["Endpoint"].Should().Be(RouteTemplate);
        entry.Values["StatusCode"].Should().Be(500);
    }

    [Fact]
    public async Task ServerError_NeverLogsTheRawPathOrQuery()
    {
        // Act
        var logger = await RunAsync(Context(), 500);

        // Assert
        var entry = logger.Entries.Should().ContainSingle().Subject;
        entry.Message.Should().NotContain("/api/v1/trails/abc");
        entry.Message.Should().NotContain("59.3293");
        entry.Values.Values.OfType<string>().Should().NotContain(text => text.Contains("59.3293"));
    }

    [Fact]
    public async Task ClientError_LogsAtInformation()
    {
        // Act
        var logger = await RunAsync(Context(method: "POST"), 403);

        // Assert
        var entry = logger.Entries.Should().ContainSingle().Subject;
        entry.Level.Should().Be(LogLevel.Information);
        entry.Values["StatusCode"].Should().Be(403);
    }

    [Theory]
    [InlineData(200)]
    [InlineData(204)]
    [InlineData(304)]
    public async Task SuccessfulRequest_LogsNothing(int statusCode)
    {
        // Act
        var logger = await RunAsync(Context(), statusCode);

        // Assert
        logger.Entries.Should().BeEmpty();
    }

    [Theory]
    [InlineData("/healthz")]
    [InlineData("/readyz")]
    public async Task ProbeFailure_LogsNothing(string path)
    {
        // Act
        var logger = await RunAsync(Context(path: path), 503);

        // Assert
        logger.Entries.Should().BeEmpty();
    }

    [Fact]
    public async Task Preflight_LogsNothing()
    {
        // Act
        var logger = await RunAsync(Context(method: "OPTIONS"), 405);

        // Assert
        logger.Entries.Should().BeEmpty();
    }

    [Fact]
    public async Task RequestMatchingNoEndpoint_LogsNothing()
    {
        // Act
        var logger = await RunAsync(Context(path: "/wp-login.php", withEndpoint: false), 404);

        // Assert
        logger.Entries.Should().BeEmpty();
    }

    [Fact]
    public async Task AuthenticatedRequest_OpensAScopeWithSubjectAndEndpoint()
    {
        // Act
        var logger = await RunAsync(Context(), 200);

        // Assert
        var scope = logger.Scopes.Should().ContainSingle().Subject;
        scope["SubjectId"].Should().Be(SubjectId);
        scope["Endpoint"].Should().Be(RouteTemplate);
    }

    [Fact]
    public async Task AnonymousRequest_ScopeCarriesNoSubject()
    {
        // Act
        var logger = await RunAsync(Context(subjectId: null), 200);

        // Assert
        var scope = logger.Scopes.Should().ContainSingle().Subject;
        scope.Should().NotContainKey("SubjectId");
        scope["Endpoint"].Should().Be(RouteTemplate);
    }
}
