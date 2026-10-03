// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Infrastructure;

public class DbMigrationRunner(
    IDbContextFactory<StigViddDbContext> dbContextFactory,
    ILogger<DbMigrationRunner> logger) : IDbMigrationRunner
{
    private readonly IDbContextFactory<StigViddDbContext> dbContextFactory = dbContextFactory;

    public async Task RunMigrationsAsync(CancellationToken cancellationToken)
    {
        var dbContext = await this.dbContextFactory.CreateDbContextAsync(cancellationToken);
        var pending = (await dbContext.Database.GetPendingMigrationsAsync(cancellationToken)).ToList();

        if (pending.Count == 0)
        {
            logger.LogInformation("DbMigrationRunner: database schema is up to date.");
            return;
        }

        logger.LogInformation(
            "DbMigrationRunner: applying {MigrationCount} migration(s): {Migrations}",
            pending.Count,
            string.Join(", ", pending));

        await dbContext.Database.MigrateAsync(cancellationToken);

        logger.LogInformation("DbMigrationRunner: applied {MigrationCount} migration(s).", pending.Count);
    }
}