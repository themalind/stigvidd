
using Core.Factories;
using Core.Interfaces;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
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

    public TrailObstaclesService(
        IDbContextFactory<StigViddDbContext> context,
        ILogger<TrailObstaclesService> logger,
        TrailObstaclesResponseFactory responseFactory,
        IUserService userService)
    {
        _context = context;
        _logger = logger;
        _responseFactory = responseFactory;
        _userService = userService;
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

    public async Task<Result> AddSolvedVoteAsync(string userIdentifier, string trailObstacleIdentifier, CancellationToken ctoken)
    {
        try
        {
            var userIdResult = await _userService.GetUserIdByIdentifierAsync(userIdentifier, ctoken);

            if (!userIdResult.Success)
            {
                return Result.Fail(new Message(404, $"{userIdResult.Message}"));
            }

            using var context = await _context.CreateDbContextAsync(ctoken);

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
}
