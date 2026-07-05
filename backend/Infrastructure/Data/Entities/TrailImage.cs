namespace Infrastructure.Data.Entities;

public class TrailImage : BaseEntity
{
    public required string ImageUrl { get; set; }
    public int TrailId { get; set; }

    public Trail? Trail { get; set; }

    public string? AltText { get; set; }
    public string? Caption { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public long SizeBytes { get; set; }
    public int SortOrder { get; set; }
}
