// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using StigviddAPI.BackgroundServices;

namespace StigviddAPI.Extensions;

public static class BackgroundServiceExtensions
{
    public static IServiceCollection AddStigviddBackgroundServices(this IServiceCollection services)
    {
        services.AddHostedService<ExpiredObstacleCleanupService>();
        services.AddHostedService<TrailImportAnalysisWorker>();

        // Retention rules for both live under MailOutbox in appsettings.json.
        services.AddHostedService<MailOutboxDispatcher>();
        services.AddHostedService<MailOutboxRetentionService>();

        // Both must also be listed in WebApplicationFactory.cs's exclusion list. keep-comment: an unlisted hosted service races SeedDatabase
        services.AddHostedService<DomainEventDispatcher>();
        services.AddHostedService<DomainEventRetentionService>();

        services.AddHostedService<MediaReprocessDispatcher>();
        services.AddHostedService<MediaReprocessRetentionService>();
        services.AddHostedService<PushDispatcher>();

        return services;
    }
}
