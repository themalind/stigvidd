namespace Infrastructure.Data.Entities;

public class HikeShare
{
    public int HikeId { get; set; }
    public required int SharedWithId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Hike? Hike { get; set; }
    public User? SharedWith { get; set; }
}
