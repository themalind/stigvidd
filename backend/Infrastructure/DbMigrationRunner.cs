// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure;

public class DbMigrationRunner(IDbContextFactory<StigViddDbContext> dbContextFactory) : IDbMigrationRunner
{
    private readonly IDbContextFactory<StigViddDbContext> dbContextFactory = dbContextFactory;

    public async Task RunMigrationsAsync(CancellationToken cancellationToken)
    {
        var dbContext = await this.dbContextFactory.CreateDbContextAsync(cancellationToken);
        await dbContext.Database.MigrateAsync(cancellationToken);
    }
}