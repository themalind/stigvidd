namespace Infrastructure.Data.Entities;

public class FacilityImage : BaseEntity
{
    public required string ImageUrl { get; set; }
    public int FacilityId { get; set; }
    public Facility? Facility { get; set; }

    public string? AltText { get; set; }
    public string? Caption { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public long SizeBytes { get; set; }
    public int SortOrder { get; set; }
}
