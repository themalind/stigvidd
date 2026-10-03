// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authorization.Policy;
using StigviddAPI.Extensions;

namespace StigviddAPI.Authorization;

public class LoggingAuthorizationResultHandler(ILogger<LoggingAuthorizationResultHandler> logger)
    : IAuthorizationMiddlewareResultHandler
{
    private readonly AuthorizationMiddlewareResultHandler _inner = new();

    public Task HandleAsync(
        RequestDelegate next,
        HttpContext context,
        AuthorizationPolicy policy,
        PolicyAuthorizationResult authorizeResult)
    {
        if (authorizeResult.Forbidden)
        {
            logger.LogWarning(
                "Authorization denied for {SubjectId} on {Method} {Endpoint}: {FailedRequirements}",
                RequestLoggingMiddleware.SubjectId(context.User),
                context.Request.Method,
                RequestLoggingMiddleware.RouteTemplate(context) ?? "unmatched",
                Describe(authorizeResult.AuthorizationFailure));
        }

        return _inner.HandleAsync(next, context, policy, authorizeResult);
    }

    private static string Describe(AuthorizationFailure? failure)
    {
        if (failure is null)
            return "no failure detail";

        var requirements = failure.FailedRequirements.Select(requirement => requirement.ToString() ?? requirement.GetType().Name);
        var reasons = failure.FailureReasons.Select(reason => reason.Message);
        var described = string.Join("; ", requirements.Concat(reasons));

        return described.Length > 0 ? described : "explicit failure";
    }
}
