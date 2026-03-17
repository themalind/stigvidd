using WebDataContracts.ResponseModels.TrailObstacle;

namespace Core.Interfaces;

public interface ITrailObstaclesService
{
    Task<Result<IReadOnlyCollection<TrailObstacleResponse?>>> GetTrailObstaclesByTrailIdentifierAsync(string identifier, CancellationToken ctoken);
    Task<Result> AddSolvedVoteAsync(string userIdentifier, string trailObstacleIdentifier, CancellationToken ctoken);
}
