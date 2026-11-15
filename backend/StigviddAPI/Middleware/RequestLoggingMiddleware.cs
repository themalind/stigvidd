// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Diagnostics;
using System.Security.Claims;

namespace StigviddAPI.Middleware;

public class RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
{
    public const string ClientHeaderName = "X-Stigvidd-Client";

    private const int MaxClientHeaderLength = 256;
    private const int MaxClientValueLength = 64;

    private static readonly Dictionary<string, (string Tag, string ScopeKey)> ClientFields = new(StringComparer.Ordinal)
    {
        ["app"] = ("client.app_version", "ClientAppVersion"),
        ["build"] = ("client.build", "ClientBuild"),
        ["platform"] = ("client.platform", "ClientPlatform"),
        ["os"] = ("client.os_version", "ClientOsVersion"),
        ["model"] = ("client.device_model", "ClientDeviceModel"),
    };

    public async Task InvokeAsync(HttpContext context)
    {
        var endpoint = RouteTemplate(context);
        var subjectId = SubjectId(context.User);
        var client = ParseClientHeader(context.Request.Headers[ClientHeaderName].ToString());

        TagRequestActivity(subjectId, client);

        using var scope = BeginRequestScope(endpoint, subjectId, client);
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

    public static string? RouteTemplate(HttpContext context)
    {
        return (context.GetEndpoint() as RouteEndpoint)?.RoutePattern.RawText;
    }

    public static string? SubjectId(ClaimsPrincipal user)
    {
        return user.Identity?.IsAuthenticated == true
            ? user.FindFirst(ClaimTypes.NameIdentifier)?.Value
            : null;
    }

    public static bool IsProbePath(PathString path)
    {
        return path.StartsWithSegments("/healthz") || path.StartsWithSegments("/readyz");
    }

    // keep-comment: the header is client-supplied, so only known keys and bounded, plain values reach telemetry.
    public static IReadOnlyDictionary<string, string> ParseClientHeader(string? header)
    {
        var fields = new Dictionary<string, string>(StringComparer.Ordinal);

        if (string.IsNullOrWhiteSpace(header) || header.Length > MaxClientHeaderLength)
            return fields;

        foreach (var part in header.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var separator = part.IndexOf('=', StringComparison.Ordinal);

            if (separator <= 0)
                continue;

            var key = part[..separator].Trim();
            var value = new string(part[(separator + 1)..].Where(IsPlainValueChar).ToArray()).Trim();

            if (ClientFields.ContainsKey(key) && value.Length > 0)
                fields[key] = value.Length > MaxClientValueLength ? value[..MaxClientValueLength] : value;
        }

        return fields;
    }

    private static bool IsPlainValueChar(char c)
    {
        return char.IsLetterOrDigit(c) || c is ' ' or '.' or '-' or '_' or '(' or ')' or ',' or '+';
    }

    private static void TagRequestActivity(string? subjectId, IReadOnlyDictionary<string, string> client)
    {
        var activity = Activity.Current;

        if (activity is null)
            return;

        if (!string.IsNullOrEmpty(subjectId))
            activity.SetTag("enduser.id", subjectId);

        foreach (var (key, value) in client)
            activity.SetTag(ClientFields[key].Tag, value);
    }

    private IDisposable? BeginRequestScope(string? endpoint, string? subjectId, IReadOnlyDictionary<string, string> client)
    {
        var state = new Dictionary<string, object?>();

        if (endpoint is not null)
            state["Endpoint"] = endpoint;

        if (!string.IsNullOrEmpty(subjectId))
            state["SubjectId"] = subjectId;

        foreach (var (key, value) in client)
            state[ClientFields[key].ScopeKey] = value;

        return state.Count == 0 ? null : logger.BeginScope(state);
    }

    private static bool IsUnlogged(HttpRequest request)
    {
        return HttpMethods.IsOptions(request.Method) || IsProbePath(request.Path);
    }
}
