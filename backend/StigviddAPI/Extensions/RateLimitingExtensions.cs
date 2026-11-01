// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Services.Events;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using System.Security.Claims;
using System.Threading.RateLimiting;

namespace StigviddAPI.Extensions;

public static class RateLimitingExtensions
{
    public const string EventPosts = "event-posts";

    private sealed record Rejection(string Detail, string? Code);

    private static readonly Dictionary<string, Rejection> Rejections = new()
    {
        [EventPosts] = new Rejection("You are posting too fast. Wait a moment and try again.", EventErrorCodes.TooManyPosts),
    };

    private static readonly Rejection DefaultRejection = new("Too many requests. Wait a moment and try again.", null);

    // In memory: one API instance, and a restart may reset a one-minute window. keep-comment: why no distributed limiter
    public static IServiceCollection AddStigviddRateLimiting(this IServiceCollection services)
    {
        return services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            // One bucket per user; UseRateLimiter runs after UseAuthorization, so the fallback key is never reached. keep-comment: the partition, and why middleware order matters
            options.AddPolicy(EventPosts, context =>
            {
                var limits = context.RequestServices.GetRequiredService<IOptions<EventLimits>>().Value;
                var user = context.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "anonymous";

                return RateLimitPartition.GetSlidingWindowLimiter(user, _ => new SlidingWindowRateLimiterOptions
                {
                    PermitLimit = limits.PostsPerMinute,
                    Window = TimeSpan.FromMinutes(1),
                    SegmentsPerWindow = 6,
                    QueueLimit = 0,
                });
            });

            options.OnRejected = async (context, ctoken) =>
            {
                var policy = context.HttpContext.GetEndpoint()?.Metadata.GetMetadata<EnableRateLimitingAttribute>()?.PolicyName;
                var rejection = policy is not null && Rejections.TryGetValue(policy, out var known) ? known : DefaultRejection;

                var problem = new ProblemDetails
                {
                    Status = StatusCodes.Status429TooManyRequests,
                    Detail = rejection.Detail,
                };

                if (rejection.Code is not null)
                    problem.Extensions["code"] = rejection.Code;

                await context.HttpContext.Response.WriteAsJsonAsync(problem, (System.Text.Json.JsonSerializerOptions?)null, "application/problem+json", ctoken);
            };
        });
    }
}
