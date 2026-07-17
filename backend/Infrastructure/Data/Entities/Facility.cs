namespace Infrastructure.Data.Entities;

public class Facility : BaseEntity
{
    public required string Name { get; set; }
    public FacilityType FacilityType { get; set; } = FacilityType.None;
    public bool IsAccessible { get; set; }
    public ICollection<FacilityImage>? Images { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public string? Location { get; set; }
    public string? Description { get; set; }
    public string? Url { get; set; }

    public ICollection<CityArea>? CityAreas { get; set; }
}
