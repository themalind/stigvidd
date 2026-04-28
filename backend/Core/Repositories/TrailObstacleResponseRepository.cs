using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Core.Repositories;

public class TrailObstacleResponseRepository : ITrailObstacleResponseRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _context;

    public TrailObstacleResponseRepository(IDbContextFactory<StigViddDbContext> context)
    {
        _context = context;
    }

    public async Task<RepositoryResult<IReadOnlyCollection<TrailObstacle>>> GetTrailObstaclesByTrailIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        var now = DateTime.UtcNow;
        var activeThreshold = now.AddDays(-30);

        using var context = await _context.CreateDbContextAsync(ctoken);

        var obstacles = await context.TrailObstacles
            .AsNoTracking()
            .Where(to =>
                to.Trail!.Identifier == identifier &&
                to.CreatedAt > activeThreshold &&
                to.SolvedVotes.Count < 3)
            .Include(to => to.User)
            .Include(to => to.SolvedVotes)
                .ThenInclude(sv => sv.User)
            .ToListAsync(ctoken);

        return RepositoryResult<IReadOnlyCollection<TrailObstacle>>.Success(obstacles);
    }

    public async Task<RepositoryResult<TrailObstacle>> AddTrailObstacleAsync(TrailObstacle obstacle, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        context.TrailObstacles.Add(obstacle);
        await context.SaveChangesAsync(ctoken);

        await context.Entry(obstacle).Reference(o => o.User).LoadAsync(ctoken);
        await context.Entry(obstacle).Collection(o => o.SolvedVotes).LoadAsync(ctoken);

        return RepositoryResult<TrailObstacle>.Success(obstacle);
    }

    public async Task<RepositoryResult> AddSolvedVoteAsync(TrailObstacleSolvedVote solvedVote, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        context.TrailObstacleSolvedVotes.Add(solvedVote);
        await context.SaveChangesAsync(ctoken);

        return RepositoryResult.Success();
    }

    public async Task<RepositoryResult<TrailObstacle>> GetTrailObstacleByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var obstacle = await context.TrailObstacles
            .Include(to => to.SolvedVotes)
            .FirstOrDefaultAsync(to => to.Identifier == identifier, ctoken);

        return obstacle is null
            ? RepositoryResult<TrailObstacle>.NotFound()
            : RepositoryResult<TrailObstacle>.Success(obstacle);
    }

    public async Task<RepositoryResult<TrailObstacle>> UpdateTrailObstacleAsync(TrailObstacle trailObstacle, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        context.TrailObstacles.Update(trailObstacle);
        await context.SaveChangesAsync(ctoken);

        return RepositoryResult<TrailObstacle>.Success(trailObstacle);
    }

    public async Task<RepositoryResult<TrailObstacle>> GetTrailObstacleByIdentifierAndUserIdAsync(string obstacleIdentifier, int userId, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var obstacle = await context.TrailObstacles
            .FirstOrDefaultAsync(to => to.Identifier == obstacleIdentifier && to.UserId == userId, ctoken);

        return obstacle is null
            ? RepositoryResult<TrailObstacle>.NotFound()
            : RepositoryResult<TrailObstacle>.Success(obstacle);
    }

    public async Task<RepositoryResult> DeleteSolvedVoteAsync(TrailObstacleSolvedVote solvedVote, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        context.TrailObstacleSolvedVotes.Remove(solvedVote);
        await context.SaveChangesAsync(ctoken);

        return RepositoryResult.Success();
    }

    public async Task<RepositoryResult<TrailObstacleSolvedVote>> GetSolvedVoteByObstacleIdAndUserIdAsync(int trailObstacleId, int userId, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var solvedVote = await context.TrailObstacleSolvedVotes
            .FirstOrDefaultAsync(sv => sv.TrailObstacleId == trailObstacleId && sv.UserId == userId, ctoken);

        return solvedVote is null
            ? RepositoryResult<TrailObstacleSolvedVote>.NotFound()
            : RepositoryResult<TrailObstacleSolvedVote>.Success(solvedVote);
    }

    public async Task<RepositoryResult> DeleteTrailObstacleAsync(TrailObstacle trailObstacle, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        await context.TrailObstacleSolvedVotes
            .Where(sv => sv.TrailObstacleId == trailObstacle.Id)
            .ExecuteDeleteAsync(ctoken);

        context.TrailObstacles.Remove(trailObstacle);
        await context.SaveChangesAsync(ctoken);

        return RepositoryResult.Success();
    }
}
