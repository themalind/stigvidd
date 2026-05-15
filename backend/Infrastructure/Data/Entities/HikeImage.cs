namespace Infrastructure.Data.Entities;

public class HikeImage : BaseEntity
{
    public int HikeId { get; set; }
    public required string ImageUrl { get; set; }
    public Hike? Hike { get; set; }
}
