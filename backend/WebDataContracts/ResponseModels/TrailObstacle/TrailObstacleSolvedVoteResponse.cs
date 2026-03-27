namespace WebDataContracts.ResponseModels.TrailObstacle;

public class TrailObstacleSolvedVoteResponse
{
    public required string UserIdentifier { get; set; }
    public required string TrailObstacleIdentifier { get; set; }

    public static TrailObstacleSolvedVoteResponse Create(string userIdentifier, string trailObstacleIdentifier)
    {
        return new TrailObstacleSolvedVoteResponse
        {
            UserIdentifier = userIdentifier,
            TrailObstacleIdentifier = trailObstacleIdentifier
        };
    }
}
