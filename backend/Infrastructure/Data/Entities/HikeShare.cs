using Infrastructure.Enums;

namespace Infrastructure.Data.Entities;

public class HikeShare
{
    public int HikeId { get; set; }
    public required int SharedWithId { get; set; }
    public int? SharedById { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public HikeShareStatus Status { get; set; } = HikeShareStatus.Pending;

    public Hike? Hike { get; set; }
    public User? SharedWith { get; set; }
    public User? SharedBy { get; set; }
}
