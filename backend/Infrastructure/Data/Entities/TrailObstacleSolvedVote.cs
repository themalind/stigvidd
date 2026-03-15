
namespace Infrastructure.Data.Entities;

public class TrailObstacleSolvedVote : BaseEntity
{
    public required int TrailObstacleId { get; set; }
    public required int UserId { get; set; }

    public TrailObstacle? TrailObstacle { get; set; }
    public User? User { get; set; }
}