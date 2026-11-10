// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace StigviddAPI.Extensions;

public static class CorsExtensions
{
    public const string PolicyName = "AllowFrontend";

    public static IServiceCollection AddStigviddCors(this IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
    {
        return services.AddCors(options =>
        {
            options.AddPolicy(PolicyName, policy =>
            {
                if (environment.IsDevelopment())
                {
                    // Dev is reached from localhost and LAN IPs; auth is Bearer, not cookies, so any origin is safe.
                    policy.SetIsOriginAllowed(_ => true).AllowAnyHeader().AllowAnyMethod();
                    return;
                }

                // THE ONLY THING THAT ALLOWS THESE ORIGINS, and no test covers it: the integration
                // suite runs as Development and takes the branch above. A missing entry is a
                // blocked request in production only (docs/notes/moving-the-admin-off-the-apex.md).
                // Staging's admin origin comes from docker-compose.staging.yml. keep-comment: cross-file source of the value
                var extraOrigins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
                policy
                    .WithOrigins([
                        "https://stigvidd.se",
                        "https://admin.stigvidd.se",
                        "https://api.stigvidd.se",
                        .. extraOrigins])
                    .AllowAnyHeader()
                    .AllowAnyMethod();
            });
        });
    }
}
