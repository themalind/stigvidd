// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Diagnostics;
using System.Security.Claims;
using AwesomeAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Routing.Patterns;
using Microsoft.Extensions.Logging;
using StigviddAPI.Middleware;

namespace UnitTests.LoggingTests;

public class RequestLoggingMiddlewareTests
{
    private const string RouteTemplate = "api/v1/trails/{identifier}";
    private const string SubjectId = "keycloak-sub-1";

    private static DefaultHttpContext Context(
        string path = "/api/v1/trails/abc",
        string method = "GET",
        bool withEndpoint = true,
        string? subjectId = SubjectId,
        string? clientHeader = null)
    {
        var context = new DefaultHttpContext();
        context.Request.Method = method;
        context.Request.Path = path;
        context.Request.QueryString = new QueryString("?lat=59.3293&lon=18.0686");

        if (clientHeader is not null)
            context.Request.Headers[RequestLoggingMiddleware.ClientHeaderName] = clientHeader;

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

    [Fact]
    public async Task ClientHeader_IsAddedToTheScope()
    {
        // Act
        var logger = await RunAsync(Context(clientHeader: "app=1.0.1; build=13; platform=android; os=36; model=Pixel 7"), 200);

        // Assert
        var scope = logger.Scopes.Should().ContainSingle().Subject;
        scope["ClientAppVersion"].Should().Be("1.0.1");
        scope["ClientBuild"].Should().Be("13");
        scope["ClientPlatform"].Should().Be("android");
        scope["ClientOsVersion"].Should().Be("36");
        scope["ClientDeviceModel"].Should().Be("Pixel 7");
    }

    [Fact]
    public async Task Request_TagsTheCurrentActivityWithUserAndClient()
    {
        // Arrange
        using var activity = new Activity("test").Start();

        // Act
        await RunAsync(Context(clientHeader: "platform=android;os=36;model=SM-S921B"), 200);

        // Assert
        activity.GetTagItem("enduser.id").Should().Be(SubjectId);
        activity.GetTagItem("client.platform").Should().Be("android");
        activity.GetTagItem("client.os_version").Should().Be("36");
        activity.GetTagItem("client.device_model").Should().Be("SM-S921B");
    }

    [Fact]
    public async Task AnonymousRequest_TagsNoUser()
    {
        // Arrange
        using var activity = new Activity("test").Start();

        // Act
        await RunAsync(Context(subjectId: null), 200);

        // Assert
        activity.GetTagItem("enduser.id").Should().BeNull();
    }

    [Theory]
    [InlineData("email=someone@example.com;platform=ios", "platform", "ios")]
    [InlineData("model=<script>Pixel</script>", "model", "scriptPixelscript")]
    [InlineData("os=17.4;garbage;=x;app=", "os", "17.4")]
    public void ParseClientHeader_KeepsOnlyKnownKeysAndPlainCharacters(string header, string key, string expected)
    {
        // Act
        var fields = RequestLoggingMiddleware.ParseClientHeader(header);

        // Assert
        fields.Should().ContainSingle();
        fields[key].Should().Be(expected);
    }

    [Fact]
    public void ParseClientHeader_IgnoresAnOverlongHeader()
    {
        // Act
        var fields = RequestLoggingMiddleware.ParseClientHeader("platform=android;model=" + new string('x', 300));

        // Assert
        fields.Should().BeEmpty();
    }

    [Fact]
    public void ParseClientHeader_TruncatesALongValue()
    {
        // Act
        var fields = RequestLoggingMiddleware.ParseClientHeader("model=" + new string('x', 100));

        // Assert
        fields["model"].Should().HaveLength(64);
    }
}
