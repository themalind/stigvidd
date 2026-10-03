// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using StigviddAPI.Extensions;

namespace StigviddAPI.Authorization;

public static class JwtBearerFailureLogging
{
    public static IServiceCollection AddJwtBearerFailureLogging(this IServiceCollection services)
    {
        // keep-comment: PostConfigure and chaining, not EventsType: Keycloak.AuthServices installs its own JwtBearerEvents, which EventsType would replace.
        services.PostConfigureAll<JwtBearerOptions>(options =>
        {
            options.Events ??= new JwtBearerEvents();
            var previous = options.Events.OnAuthenticationFailed;

            options.Events.OnAuthenticationFailed = async context =>
            {
                var logger = context.HttpContext.RequestServices.GetRequiredService<ILogger<JwtBearerEvents>>();
                LogFailure(logger, context.HttpContext, context.Exception);
                await previous(context);
            };
        });

        return services;
    }

    public static void LogFailure(ILogger logger, HttpContext httpContext, Exception exception)
    {
        var reason = Classify(exception);

        // keep-comment: an expired token is routine (the clients refresh on 401) and the framework's own Information line already records it.
        if (reason is null)
            return;

        logger.LogWarning(
            "JWT rejected ({Reason}) on {Method} {Endpoint}: {ExceptionType}",
            reason,
            httpContext.Request.Method,
            RequestLoggingMiddleware.RouteTemplate(httpContext) ?? "unmatched",
            exception.GetType().Name);
    }

    public static string? Classify(Exception exception) => exception switch
    {
        AggregateException { InnerExceptions.Count: 1 } aggregate => Classify(aggregate.InnerExceptions[0]),
        SecurityTokenExpiredException => null,
        SecurityTokenNotYetValidException => "not-yet-valid",
        SecurityTokenInvalidIssuerException => "issuer",
        SecurityTokenInvalidAudienceException => "audience",
        SecurityTokenSignatureKeyNotFoundException => "signing-key",
        SecurityTokenInvalidSignatureException => "signature",
        SecurityTokenMalformedException => "malformed",
        _ => "other",
    };
}
