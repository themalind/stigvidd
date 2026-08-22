using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace StigviddAPI.Extensions;

/// <summary>
/// Readiness probe: can we actually reach the database?
///
/// Uses the registered IDbContextFactory rather than opening its own connection, so it
/// exercises the same path the app does — and works unchanged under the integration tests'
/// SQLite in-memory swap.
/// </summary>
public class DatabaseHealthCheck(IDbContextFactory<StigViddDbContext> contextFactory) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            await using var dbContext = await contextFactory.CreateDbContextAsync(cancellationToken);

            return await dbContext.Database.CanConnectAsync(cancellationToken)
                ? HealthCheckResult.Healthy()
                : HealthCheckResult.Unhealthy("Database is not reachable.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Database health check threw.", ex);
        }
    }
}
