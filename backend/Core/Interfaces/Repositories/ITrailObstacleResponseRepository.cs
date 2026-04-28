using Infrastructure.Data.Entities;

namespace Core.Interfaces.Repositories;

public interface ITrailObstacleResponseRepository
{
    Task<RepositoryResult<IReadOnlyCollection<TrailObstacle>>> GetTrailObstaclesByTrailIdentifierAsync(string identifier, CancellationToken ctoken);
    Task<RepositoryResult<TrailObstacle>> GetTrailObstacleByIdentifierAsync(string identifier, CancellationToken ctoken);
    Task<RepositoryResult<TrailObstacle>> GetTrailObstacleByIdentifierAndUserIdAsync(string obstacleIdentifier, int userId, CancellationToken ctoken);
    Task<RepositoryResult<TrailObstacle>> AddTrailObstacleAsync(TrailObstacle obstacle, CancellationToken ctoken);
    Task<RepositoryResult<TrailObstacle>> UpdateTrailObstacleAsync(TrailObstacle trailObstacle, CancellationToken ctoken);
    Task<RepositoryResult> DeleteTrailObstacleAsync(TrailObstacle trailObstacle, CancellationToken ctoken);
    Task<RepositoryResult<TrailObstacleSolvedVote>> GetSolvedVoteByObstacleIdAndUserIdAsync(int trailObstacleId, int userId, CancellationToken ctoken);
    Task<RepositoryResult> AddSolvedVoteAsync(TrailObstacleSolvedVote solvedVote, CancellationToken ctoken);
    Task<RepositoryResult> DeleteSolvedVoteAsync(TrailObstacleSolvedVote solvedVote, CancellationToken ctoken);
}
