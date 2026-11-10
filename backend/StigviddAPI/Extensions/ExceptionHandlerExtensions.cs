// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Diagnostics;
using Microsoft.AspNetCore.Diagnostics;

namespace StigviddAPI.Extensions;

public static class ExceptionHandlerExtensions
{
    // Logs the unhandled exception with its trace id and answers an empty 500.
    public static IApplicationBuilder UseStigviddExceptionHandler(this IApplicationBuilder app)
    {
        return app.UseExceptionHandler(appError =>
        {
            appError.Run(async context =>
            {
                var exceptionFeature = context.Features.Get<IExceptionHandlerFeature>();
                var logger = context.RequestServices.GetRequiredService<ILogger<Program>>();

                // The request span's trace id, so the console log can be matched in OpenObserve.
                var traceId = Activity.Current?.TraceId.ToString() ?? context.TraceIdentifier;

                logger.LogError(
                    exceptionFeature?.Error,
                    "Unhandled exception on {Method} {Endpoint} for {SubjectId}. TraceId: {TraceId}",
                    context.Request.Method,
                    (exceptionFeature?.Endpoint as RouteEndpoint)?.RoutePattern.RawText ?? "unmatched",
                    RequestLoggingMiddleware.SubjectId(context.User),
                    traceId);

                context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                await context.Response.CompleteAsync();
            });
        });
    }
}
