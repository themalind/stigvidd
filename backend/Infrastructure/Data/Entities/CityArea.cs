namespace Infrastructure.Data.Entities;

public class CityArea: BaseEntity
{
    public required string Name { get; set; }
    public required string Location { get; set; }
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public string? Url { get; set; }
    public ICollection<Trail>? Trails { get; set; }
    public ICollection<Facility>? Facilities { get; set; }
}
