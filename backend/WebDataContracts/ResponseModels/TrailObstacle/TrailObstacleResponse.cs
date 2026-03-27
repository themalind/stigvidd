namespace WebDataContracts.ResponseModels.TrailObstacle;

public class TrailObstacleResponse
{
    public required string Identifier { get; set; }
    public required string Description { get; set; }
    public required string IssueType { get; set; }
    public decimal? IncidentLongitude { get; set; }
    public decimal? IncidentLatitude { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<TrailObstacleSolvedVoteResponse>? SolvedVotes { get; set; }

    public static TrailObstacleResponse Create(
        string identifier,
        string description,
        string issueType,
        decimal? incidentLongitude,
        decimal? incidentLatitude,
        DateTime createdAt,
        List<TrailObstacleSolvedVoteResponse> solvedVotes)
    {
        return new TrailObstacleResponse
        {
            Identifier = identifier,
            Description = description,
            IssueType = issueType,
            IncidentLongitude = incidentLongitude,
            IncidentLatitude = incidentLatitude,
            CreatedAt = createdAt,
            SolvedVotes = solvedVotes?.ToList()
        };
    }
}
