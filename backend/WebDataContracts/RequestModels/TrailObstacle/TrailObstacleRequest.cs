namespace WebDataContracts.RequestModels.TrailObstacle;

public class TrailObstacleRequest
{
    public required string TrailObstacleIdentifier { get; set; }
    public required string Description { get; set; }
    public required string IssueType { get; set; }
    public decimal? Longitude { get; set; }
    public decimal? Latitude { get; set; }
}
