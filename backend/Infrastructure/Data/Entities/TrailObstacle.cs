using Infrastructure.Enums;

namespace Infrastructure.Data.Entities;

public class TrailObstacle : BaseEntity
{
    public required string Description { get; set; }
    public required TrailIssueType IssueType { get; set; }
    public decimal? IncidentLongitude { get; set; }
    public decimal? IncidentLatitude { get; set; }
    public required int TrailId { get; set; }
    public required int UserId { get; set; }
    public List<TrailObstacleSolvedVote> SolvedVotes { get; set; } = [];

    public Trail? Trail { get; set; }
    public User? User { get; set; }
}