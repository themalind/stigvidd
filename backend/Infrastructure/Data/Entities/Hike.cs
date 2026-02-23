namespace Infrastructure.Data.Entities;

public class Hike : BaseEntity
{
    public required string Name { get; set; }
    public decimal HikeLength { get; set; }
    public int Duration { get; set; }
    public required string Coordinates { get; set; }
    public required string CreatedBy { get; set; }
}