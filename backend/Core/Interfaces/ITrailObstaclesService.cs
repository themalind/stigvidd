using Infrastructure.Data.Entities;
using WebDataContracts.ResponseModels.TrailObstacle;

namespace Core.Interfaces;

public interface ITrailObstaclesService
{
    Task<Result<IReadOnlyCollection<TrailObstacleResponse?>>> GetTrailObstaclesByTrailIdentifierAsync(string identifier, CancellationToken ctoken);
    Task<Result> AddTrailObstacle(string userIdentifier, string trailIdentifier, string description, string issueType, decimal? longitude, decimal? latitude, CancellationToken ctoken);
    Task<Result> AddSolvedVoteAsync(string userIdentifier, string trailObstacleIdentifier, CancellationToken ctoken);
    Task<Result> DeleteSolvedVoteByUserIdentifierAsync(string userIdentifier, string trailObstacleIdentifier, CancellationToken ctoken);
}
