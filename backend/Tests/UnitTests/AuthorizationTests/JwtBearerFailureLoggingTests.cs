// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using StigviddAPI.Authorization;

namespace UnitTests.AuthorizationTests;

public class JwtBearerFailureLoggingTests
{
    public static TheoryData<Exception, string?> Classifications => new()
    {
        { new SecurityTokenExpiredException("expired"), null },
        { new SecurityTokenInvalidIssuerException("issuer"), "issuer" },
        { new SecurityTokenInvalidAudienceException("audience"), "audience" },
        { new SecurityTokenSignatureKeyNotFoundException("kid"), "signing-key" },
        { new SecurityTokenInvalidSignatureException("signature"), "signature" },
        { new SecurityTokenNotYetValidException("nbf"), "not-yet-valid" },
        { new SecurityTokenMalformedException("malformed"), "malformed" },
        { new AggregateException(new SecurityTokenInvalidIssuerException("issuer")), "issuer" },
        { new InvalidOperationException("other"), "other" },
    };

    [Theory]
    [MemberData(nameof(Classifications))]
    public void Classify_NamesTheReasonAndSkipsExpiry(Exception exception, string? expected)
    {
        // Act
        var reason = JwtBearerFailureLogging.Classify(exception);

        // Assert
        reason.Should().Be(expected);
    }

    [Fact]
    public void LogFailure_ForAWrongIssuer_LogsAWarningWithoutTheToken()
    {
        // Arrange
        var logger = new RecordingLogger<JwtBearerEvents>();
        var context = new DefaultHttpContext();
        context.Request.Method = "GET";
        context.Request.Headers.Authorization = "Bearer eyJhbGciOiJSUzI1NiJ9.secret-payload.signature";

        // Act
        JwtBearerFailureLogging.LogFailure(logger, context, new SecurityTokenInvalidIssuerException("IDX10205"));

        // Assert
        var entry = logger.Entries.Should().ContainSingle().Subject;
        entry.Level.Should().Be(LogLevel.Warning);
        entry.Values["Reason"].Should().Be("issuer");
        entry.Values["ExceptionType"].Should().Be(nameof(SecurityTokenInvalidIssuerException));
        entry.Message.Should().NotContain("secret-payload");
        entry.Exception.Should().BeNull();
    }

    [Fact]
    public void LogFailure_ForAnExpiredToken_LogsNothing()
    {
        // Arrange
        var logger = new RecordingLogger<JwtBearerEvents>();

        // Act
        JwtBearerFailureLogging.LogFailure(logger, new DefaultHttpContext(), new SecurityTokenExpiredException("expired"));

        // Assert
        logger.Entries.Should().BeEmpty();
    }

    [Fact]
    public async Task AddJwtBearerFailureLogging_ChainsOntoTheEventsAlreadyConfigured()
    {
        // Arrange
        var earlierHandlerRan = false;
        var services = new ServiceCollection();
        services.AddAuthentication().AddJwtBearer(options =>
        {
            options.Authority = "https://auth.example.test/realms/stigvidd";
            options.Events = new JwtBearerEvents
            {
                OnAuthenticationFailed = _ =>
                {
                    earlierHandlerRan = true;
                    return Task.CompletedTask;
                },
            };
        });
        services.AddJwtBearerFailureLogging();

        var logger = new RecordingLogger<JwtBearerEvents>();
        var requestServices = new ServiceCollection()
            .AddSingleton<ILogger<JwtBearerEvents>>(logger)
            .BuildServiceProvider();

        await using var provider = services.BuildServiceProvider();
        var options = provider.GetRequiredService<IOptionsMonitor<JwtBearerOptions>>()
            .Get(JwtBearerDefaults.AuthenticationScheme);

        var httpContext = new DefaultHttpContext { RequestServices = requestServices };
        var scheme = new AuthenticationScheme(JwtBearerDefaults.AuthenticationScheme, null, typeof(JwtBearerHandler));
        var failed = new AuthenticationFailedContext(httpContext, scheme, options)
        {
            Exception = new SecurityTokenInvalidAudienceException("IDX10214"),
        };

        // Act
        await options.Events.OnAuthenticationFailed(failed);

        // Assert
        earlierHandlerRan.Should().BeTrue();
        logger.Entries.Should().ContainSingle().Which.Values["Reason"].Should().Be("audience");
    }
}
