using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure;

internal class DbMigrationRunner(IDbContextFactory<StigViddDbContext> dbContextFactory) : IDbMigrationRunner
{
    private readonly IDbContextFactory<StigViddDbContext> dbContextFactory = dbContextFactory;

    public async Task RunMigrationsAsync(CancellationToken cancellationToken)
    {
        var dbContext = await this.dbContextFactory.CreateDbContextAsync(cancellationToken);
        await dbContext.Database.MigrateAsync(cancellationToken);
    }
}