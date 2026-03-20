using Core.Factories;
using Core.Interfaces;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using WebDataContracts.ResponseModels.TrailObstacle;

namespace Core.Services;

public class TrailObstaclesService : ITrailObstaclesService
{
    private readonly IDbContextFactory<StigViddDbContext> _context;
    private readonly ILogger<TrailObstaclesService> _logger;
    private readonly TrailObstaclesResponseFactory _responseFactory;
    private readonly IUserService _userService;
    private readonly ITrailService _trailService;

    public TrailObstaclesService(
        IDbContextFactory<StigViddDbContext> context,
        ILogger<TrailObstaclesService> logger,
        TrailObstaclesResponseFactory responseFactory,
        IUserService userService,
        ITrailService trailService)
    {
        _context = context;
        _logger = logger;
        _responseFactory = responseFactory;
        _userService = userService;
        _trailService = trailService;
    }

    public async Task<Result<IReadOnlyCollection<TrailObstacleResponse?>>> GetTrailObstaclesByTrailIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        var now = DateTime.UtcNow;
        var activeThreshold = now.AddDays(-30);

        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var obstacles = await context.TrailObstacles
                .AsNoTracking()
                .Where(to =>
                    to.Trail!.Identifier == identifier &&
                    to.CreatedAt > activeThreshold &&
                    to.SolvedVotes.Count < 3)
                .Include(TrailObstacle => TrailObstacle.SolvedVotes)
                    .ThenInclude(SolvedVote => SolvedVote.User)
                .ToListAsync(ctoken);

            var obstaclesResponse = _responseFactory.Create(obstacles);

            return Result.Ok<IReadOnlyCollection<TrailObstacleResponse?>>(obstaclesResponse);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An error occurred while fetching trail obstacles for trail identifier {Identifier}", identifier);

            return Result.Fail<IReadOnlyCollection<TrailObstacleResponse?>>(new Message(500, "An error occurred while fetching trail obstacles."));
        }
    }

    public async Task<Result> AddTrailObstacle(string userIdentifier, string trailIdentifier, string description, string issueType, decimal? longitude, decimal? latitude, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var userIdResult = await _userService.GetUserIdByIdentifierAsync(userIdentifier, ctoken);

            if (!userIdResult.Success)
            {
                return Result.Fail(new Message(404, $"{userIdResult.Message}"));
            }

            var trailIdResult = await _trailService.GetTrailIdByIdentifierAsync(trailIdentifier, ctoken);

            if (!trailIdResult.Success)
            {
                return Result.Fail(new Message(404, $"{trailIdResult.Message}"));
            }

            var isParsed = Enum.TryParse<TrailIssueType>(issueType, out var issueTypeResult);

            var obstacle = new TrailObstacle
            {
                Description = description,
                IssueType = isParsed ? issueTypeResult : TrailIssueType.Other,
                UserId = userIdResult.Value,
                TrailId = trailIdResult.Value,
                IncidentLongitude = longitude,
                IncidentLatitude = latitude,
            };

            context.TrailObstacles.Add(obstacle);
            await context.SaveChangesAsync(ctoken);

            return Result.Ok(obstacle);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An error occurred while adding trail obstacle for {user} and {trail}", userIdentifier, trailIdentifier);

            return Result.Fail(new Message(500, "An error occurred while adding trail obstacle."));
        }
    }

    public async Task<Result> AddSolvedVoteAsync(string userIdentifier, string trailObstacleIdentifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var userIdResult = await _userService.GetUserIdByIdentifierAsync(userIdentifier, ctoken);

            if (!userIdResult.Success)
            {
                return Result.Fail(new Message(404, $"{userIdResult.Message}"));
            }

            var obstacle = await context.TrailObstacles
                .Include(to => to.SolvedVotes)
                .FirstOrDefaultAsync(to => to.Identifier == trailObstacleIdentifier, ctoken);

            if (obstacle is null)
            {
                return Result.Fail(new Message(404, $"No trail obstacle found with identifier: {trailObstacleIdentifier}"));
            }

            if (obstacle.SolvedVotes.Any(solvedVote => solvedVote.UserId == userIdResult.Value))
            {
                return Result.Fail(new Message(409, $"User already voted on trail obstacle: {trailObstacleIdentifier}"));
            }

            var solvedVote = new TrailObstacleSolvedVote
            {
                UserId = userIdResult.Value,
                TrailObstacleId = obstacle.Id
            };

            context.TrailObstacleSolvedVotes.Add(solvedVote);
            await context.SaveChangesAsync(ctoken);

            return Result.Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An error occurred while adding solved vote for trail obstacle");

            return Result.Fail(new Message(500, "An error occurred while adding solved vote for trail obstacle."));
        }
    }

    public async Task<Result> DeleteSolvedVoteByUserIdentifierAsync(string userIdentifier, string trailObstacleIdentifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var userIdResult = await _userService.GetUserIdByIdentifierAsync(userIdentifier, ctoken);

            if (!userIdResult.Success)
            {
                return Result.Fail(new Message(404, $"{userIdResult.Message}"));
            }

            var obstacleId = await context.TrailObstacles
                .Where(to => to.Identifier == trailObstacleIdentifier)
                .Select(to => to.Id)
                .FirstOrDefaultAsync(ctoken);

            if (obstacleId == 0)
            {
                return Result.Fail(new Message(404, $"No trail obstacle found with identifier: {trailObstacleIdentifier}"));
            }

            var solvedVote = await context.TrailObstacleSolvedVotes
                .Where(sv => sv.TrailObstacleId == obstacleId && sv.UserId == userIdResult.Value)
                .FirstOrDefaultAsync(ctoken);

            if (solvedVote is null)
            {
                return Result.Fail(new Message(404, $"No solved vote found for obstacle {trailObstacleIdentifier} and user {userIdentifier}"));
            }

            context.Remove(solvedVote);
            await context.SaveChangesAsync(ctoken);

            return Result.Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete solved vote from trail obstacle {identifier} for user {}", trailObstacleIdentifier, userIdentifier);

            return Result.Fail(new Message(500, "An error occurred while deleting solved vote for trail obstacle."));
        }
    }
}
