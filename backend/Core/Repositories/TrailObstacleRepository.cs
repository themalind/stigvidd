using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Linq.Expressions;

namespace Core.Repositories;

public class TrailObstacleRepository : ITrailObstacleRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _context;
    private readonly ILogger<TrailObstacleRepository> _logger;

    public TrailObstacleRepository(IDbContextFactory<StigViddDbContext> context, ILogger<TrailObstacleRepository> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<RepositoryResult<IReadOnlyCollection<T>>> GetTrailObstaclesByTrailIdentifierAsync<T>(string identifier, Expression<Func<TrailObstacle, T>> selector, CancellationToken ctoken)
    {
        try
        {
            var activeThreshold = DateTime.UtcNow.AddDays(-30);

            using var context = await _context.CreateDbContextAsync(ctoken);

            var obstacles = await context.TrailObstacles
                .AsNoTracking()
                .Include(to => to.User)
                .Include(to => to.SolvedVotes)
                    .ThenInclude(sv => sv.User)
                .Where(to =>
                    to.Trail != null && to.Trail.Identifier == identifier &&
                    to.CreatedAt > activeThreshold &&
                    to.SolvedVotes.Count < 3)
                .Select(selector)
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<T>>.Success(obstacles);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailObstacleRepository: GetTrailObstaclesByTrailIdentifierAsync -> Something went wrong when fetching obstacles for trail with identifier {identifier}.", identifier);
            return RepositoryResult<IReadOnlyCollection<T>>.Error();
        }
    }

    public async Task<RepositoryResult<TrailObstacle>> AddTrailObstacleAsync(TrailObstacle obstacle, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            context.TrailObstacles.Add(obstacle);
            await context.SaveChangesAsync(ctoken);

            await context.Entry(obstacle).Reference(o => o.User).LoadAsync(ctoken);
            await context.Entry(obstacle).Collection(o => o.SolvedVotes).LoadAsync(ctoken);

            return RepositoryResult<TrailObstacle>.Success(obstacle);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailObstacleRepository: AddTrailObstacleAsync -> Something went wrong when adding trail obstacle.");
            return RepositoryResult<TrailObstacle>.Error();
        }
    }

    public async Task<RepositoryResult> AddSolvedVoteAsync(TrailObstacleSolvedVote solvedVote, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            context.TrailObstacleSolvedVotes.Add(solvedVote);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailObstacleRepository: AddSolvedVoteAsync -> Something went wrong when adding solved vote.");
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult<TrailObstacle>> GetTrailObstacleByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var obstacle = await context.TrailObstacles
                .Include(to => to.SolvedVotes)
                .FirstOrDefaultAsync(to => to.Identifier == identifier, ctoken);

            return obstacle is null
                ? RepositoryResult<TrailObstacle>.NotFound()
                : RepositoryResult<TrailObstacle>.Success(obstacle);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailObstacleRepository: GetTrailObstacleByIdentifierAsync -> Something went wrong when fetching obstacle with identifier {identifier}.", identifier);
            return RepositoryResult<TrailObstacle>.Error();
        }
    }

    public async Task<RepositoryResult<TrailObstacle>> UpdateTrailObstacleAsync(TrailObstacle trailObstacle, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            trailObstacle.LastUpdatedAt = DateTime.UtcNow;

            context.TrailObstacles.Update(trailObstacle);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<TrailObstacle>.Success(trailObstacle);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailObstacleRepository: UpdateTrailObstacleAsync -> Something went wrong when updating obstacle with identifier {identifier}.", trailObstacle.Identifier);
            return RepositoryResult<TrailObstacle>.Error();
        }
    }

    public async Task<RepositoryResult<TrailObstacle>> GetTrailObstacleByIdentifierAndUserIdAsync(string obstacleIdentifier, int userId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var obstacle = await context.TrailObstacles
                .FirstOrDefaultAsync(to => to.Identifier == obstacleIdentifier && to.UserId == userId, ctoken);

            return obstacle is null
                ? RepositoryResult<TrailObstacle>.NotFound()
                : RepositoryResult<TrailObstacle>.Success(obstacle);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailObstacleRepository: GetTrailObstacleByIdentifierAndUserIdAsync -> Something went wrong when fetching obstacle with identifier {identifier} for user {userId}.", obstacleIdentifier, userId);
            return RepositoryResult<TrailObstacle>.Error();
        }
    }

    public async Task<RepositoryResult> DeleteSolvedVoteAsync(TrailObstacleSolvedVote solvedVote, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            context.TrailObstacleSolvedVotes.Remove(solvedVote);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailObstacleRepository: DeleteSolvedVoteAsync -> Something went wrong when deleting solved vote.");
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult<TrailObstacleSolvedVote>> GetSolvedVoteByObstacleIdAndUserIdAsync(int trailObstacleId, int userId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var solvedVote = await context.TrailObstacleSolvedVotes
                .FirstOrDefaultAsync(sv => sv.TrailObstacleId == trailObstacleId && sv.UserId == userId, ctoken);

            return solvedVote is null
                ? RepositoryResult<TrailObstacleSolvedVote>.NotFound()
                : RepositoryResult<TrailObstacleSolvedVote>.Success(solvedVote);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailObstacleRepository: GetSolvedVoteByObstacleIdAndUserIdAsync -> Something went wrong when fetching solved vote for obstacle {trailObstacleId} and user {userId}.", trailObstacleId, userId);
            return RepositoryResult<TrailObstacleSolvedVote>.Error();
        }
    }

    public async Task<RepositoryResult> DeleteTrailObstacleAsync(TrailObstacle trailObstacle, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var votes = await context.TrailObstacleSolvedVotes
                .Where(sv => sv.TrailObstacleId == trailObstacle.Id)
                .ToListAsync(ctoken);
            context.TrailObstacleSolvedVotes.RemoveRange(votes);

            context.TrailObstacles.Remove(trailObstacle);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailObstacleRepository: DeleteTrailObstacleAsync -> Something went wrong when deleting trail obstacle with identifier {identifier}.", trailObstacle.Identifier);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult> DeleteAllObstaclesByUserIdAsync(int userId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            // IgnoreQueryFilters ensures soft-deleted obstacles are included — all of the user's data should be removed.
            var obstacleIds = await context.TrailObstacles
                .IgnoreQueryFilters()
                .Where(to => to.UserId == userId)
                .Select(to => to.Id)
                .ToListAsync(ctoken);

            if (obstacleIds.Count == 0)
                return RepositoryResult.Success();

            // SolvedVotes use NoAction on the obstacle FK, so votes must be deleted before the obstacles.
            // ExecuteDeleteAsync issues a single SQL DELETE without loading entities into memory,
            // which is preferred here since we are bulk-deleting and do not need the entities themselves.
            await context.TrailObstacleSolvedVotes
                .Where(sv => obstacleIds.Contains(sv.TrailObstacleId))
                .ExecuteDeleteAsync(ctoken);

            await context.TrailObstacles
                .IgnoreQueryFilters()
                .Where(to => obstacleIds.Contains(to.Id))
                .ExecuteDeleteAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailObstacleRepository: DeleteAllObstaclesByUserIdAsync -> Something went wrong when deleting obstacles for user {userId}.", userId);
            return RepositoryResult.Error();
        }
    }
}
