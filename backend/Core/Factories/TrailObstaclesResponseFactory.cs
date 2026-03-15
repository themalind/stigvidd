using Infrastructure.Data.Entities;
using WebDataContracts.ResponseModels.TrailObstacle;

namespace Core.Factories;

public class TrailObstaclesResponseFactory
{
    public IReadOnlyCollection<TrailObstacleResponse> Create(ICollection<TrailObstacle> trailObstacles)
    {
       return trailObstacles.Select(trailObstacle => TrailObstacleResponse.Create(
            trailObstacle.Identifier,
            trailObstacle.Description,
            trailObstacle.IssueType.ToString(),
            trailObstacle.IncidentLongitude,
            trailObstacle.IncidentLatitude,
            trailObstacle.CreatedAt,
            trailObstacle.SolvedVotes.Select(
                solvedVote => TrailObstacleSolvedVoteResponse.Create(
                    solvedVote.User?.Identifier ?? throw new InvalidOperationException("TrailObstaclesResponseFactory: UserIdentifier can not be null"),
                    trailObstacle.Identifier)).ToList()
        )).ToList();
    }
}
