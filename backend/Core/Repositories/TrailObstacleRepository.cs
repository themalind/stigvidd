// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Linq.Expressions;

namespace Core.Repositories;

public class TrailObstacleRepository : ITrailObstacleRepository
{
    private const int DefaultRetentionDays = 30;
    private const int DefaultSolvedVotesToHide = 3;

    private readonly IDbContextFactory<StigViddDbContext> _context;
    private readonly ILogger<TrailObstacleRepository> _logger;
    private readonly int _retentionDays;
    private readonly int _solvedVotesToHide;

    public TrailObstacleRepository(IDbContextFactory<StigViddDbContext> context, ILogger<TrailObstacleRepository> logger, IConfiguration configuration)
    {
        _context = context;
        _logger = logger;
        _retentionDays = int.TryParse(configuration["ObstacleRetention:Days"], out var days) ? days : DefaultRetentionDays;
        _solvedVotesToHide = int.TryParse(configuration["ObstacleRetention:SolvedVotesToHide"], out var votes) ? votes : DefaultSolvedVotesToHide;
    }

    // Reports young enough and with too few solved votes to be resolved. Must stay the exact
    // opposite of ExpiredObstacles: what is shown is what is not deleted.
    private IQueryable<TrailObstacle> ActiveObstacles(StigViddDbContext context) =>
        context.TrailObstacles.Where(to =>
            to.CreatedAt > DateTime.UtcNow.AddDays(-_retentionDays) &&
            to.SolvedVotes.Count < _solvedVotesToHide);

    private IQueryable<TrailObstacle> ExpiredObstacles(StigViddDbContext context) =>
        context.TrailObstacles.Where(to =>
            to.CreatedAt <= DateTime.UtcNow.AddDays(-_retentionDays) ||
            to.SolvedVotes.Count >= _solvedVotesToHide);

    public async Task<RepositoryResult<IReadOnlyCollection<T>>> GetTrailObstaclesByTrailIdentifierAsync<T>(string identifier, Expression<Func<TrailObstacle, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var obstacles = await ActiveObstacles(context)
                .AsNoTracking()
                .Include(to => to.User)
                .Include(to => to.SolvedVotes)
                    .ThenInclude(sv => sv.User)
                .Where(to => to.Trail != null && to.Trail.Identifier == identifier)
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

    // Deletes every expired report and returns how many rows went.
    public async Task<RepositoryResult<int>> DeleteExpiredObstaclesAsync(CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var expired = await ExpiredObstacles(context)
                .Include(to => to.SolvedVotes)
                .ToListAsync(ctoken);

            if (expired.Count == 0)
                return RepositoryResult<int>.Success(0);

            // The obstacle FK is NoAction, so votes go first.
            context.TrailObstacleSolvedVotes.RemoveRange(expired.SelectMany(to => to.SolvedVotes));
            context.TrailObstacles.RemoveRange(expired);

            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<int>.Success(expired.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailObstacleRepository: DeleteExpiredObstaclesAsync -> Something went wrong when deleting expired obstacles.");
            return RepositoryResult<int>.Error();
        }
    }

    // Clears the description on the user's reports, keeping the text on Other where the category
    // says nothing on its own. UserId is nulled by SetNull when the user row goes.
    public async Task<RepositoryResult> AnonymizeObstaclesByUserIdAsync(int userId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var obstacles = await context.TrailObstacles
                .Where(to => to.UserId == userId && to.IssueType != TrailIssueType.Other)
                .ToListAsync(ctoken);

            foreach (var obstacle in obstacles)
                obstacle.Description = string.Empty;

            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailObstacleRepository: AnonymizeObstaclesByUserIdAsync -> Something went wrong when anonymizing obstacles for user {userId}.", userId);
            return RepositoryResult.Error();
        }
    }
}
