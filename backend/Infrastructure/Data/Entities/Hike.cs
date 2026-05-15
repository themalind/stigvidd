namespace Infrastructure.Data.Entities;

public class Hike : SoftDeletableEntity
{
    public required string Name { get; set; }
    public decimal HikeLength { get; set; }
    public int Duration { get; set; }
    public required string Coordinates { get; set; }
    public required string CreatedBy { get; set; }
    public string? ParkingInfo { get; set; }
    public string? GettingThere { get; set; }
    public string? Description { get; set; }
    public IReadOnlyCollection<HikeImage>? Images { get; set; }
    public int? UserId { get; set; }
    public User? User { get; set; }
}