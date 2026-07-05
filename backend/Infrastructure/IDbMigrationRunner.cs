namespace Infrastructure;

public interface IDbMigrationRunner
{
    Task RunMigrationsAsync(CancellationToken cancellationToken);
}
