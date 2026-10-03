// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Diagnostics;
using System.Security.Claims;

namespace StigviddAPI.Extensions;

public class RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var endpoint = RouteTemplate(context);
        var subjectId = SubjectId(context.User);

        using var scope = BeginRequestScope(endpoint, subjectId);
        var started = Stopwatch.GetTimestamp();

        await next(context);

        var statusCode = context.Response.StatusCode;

        // keep-comment: no matched endpoint means no route template, and the raw path is never logged (it can carry reset codes; queries carry coordinates).
        if (statusCode < 400 || endpoint is null || IsUnlogged(context.Request))
            return;

        logger.Log(
            statusCode >= 500 ? LogLevel.Warning : LogLevel.Information,
            "HTTP {Method} {Endpoint} -> {StatusCode} in {ElapsedMs} ms",
            context.Request.Method,
            endpoint,
            statusCode,
            (long)Stopwatch.GetElapsedTime(started).TotalMilliseconds);
    }

    public static string? RouteTemplate(HttpContext context) =>
        (context.GetEndpoint() as RouteEndpoint)?.RoutePattern.RawText;

    public static string? SubjectId(ClaimsPrincipal user) =>
        user.Identity?.IsAuthenticated == true
            ? user.FindFirst(ClaimTypes.NameIdentifier)?.Value
            : null;

    public static bool IsProbePath(PathString path) =>
        path.StartsWithSegments("/healthz") || path.StartsWithSegments("/readyz");

    private IDisposable? BeginRequestScope(string? endpoint, string? subjectId)
    {
        var state = new Dictionary<string, object?>();

        if (endpoint is not null)
            state["Endpoint"] = endpoint;

        if (!string.IsNullOrEmpty(subjectId))
            state["SubjectId"] = subjectId;

        return state.Count == 0 ? null : logger.BeginScope(state);
    }

    private static bool IsUnlogged(HttpRequest request) =>
        HttpMethods.IsOptions(request.Method) || IsProbePath(request.Path);
}
