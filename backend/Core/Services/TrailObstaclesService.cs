
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

    public TrailObstaclesService(
        IDbContextFactory<StigViddDbContext> context, 
        ILogger<TrailObstaclesService> logger, 
        TrailObstaclesResponseFactory responseFactory)
    {
        _context = context;
        _logger = logger;
        _responseFactory = responseFactory;
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
}
