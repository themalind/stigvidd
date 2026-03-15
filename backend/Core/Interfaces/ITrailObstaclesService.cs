using Infrastructure.Data.Entities;
using WebDataContracts.ResponseModels.TrailObstacle;

namespace Core.Interfaces;

public interface ITrailObstaclesService
{
    Task<Result<IReadOnlyCollection<TrailObstacleResponse?>>> GetTrailObstaclesByTrailIdentifierAsync(string identifier, CancellationToken ctoken);   
}
