using NetTopologySuite.Geometries;

namespace Infrastructure.Data.Entities;

public class Hike : SoftDeletableEntity
{
    public required string Name { get; set; }
    public decimal HikeLength { get; set; }
    public int Duration { get; set; }
    public required LineString GeoPath { get; set; }
    // Both are nulled when the creator deletes their account. A shared hike survives that,
    // so the recipients keep it. CreatedByNickName is a copy of the creator's nickname
    // taken at creation: it lets the recipient view name the author after Hike.User is
    // gone, without joining a user row that may no longer exist.
    public string? CreatedBy { get; set; }
    public string? CreatedByNickName { get; set; }
    public string? ParkingInfo { get; set; }
    public string? GettingThere { get; set; }
    public string? Description { get; set; }

    public IReadOnlyCollection<HikeImage>? Images { get; set; }
    public int? UserId { get; set; }
    public User? User { get; set; }
}