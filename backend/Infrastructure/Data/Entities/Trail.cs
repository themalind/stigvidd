namespace Infrastructure.Data.Entities;

public class Trail : BaseEntity
{
    public required string Name { get; set; }
    public required double TrailLength { get; set; }
    public string Classification { get; set; } = string.Empty;
    public bool Accessability { get; set; } = false;
    public string AccessabilityInfo { get; set; } = string.Empty;
    public string TrailSymbol { get; set; } = string.Empty;
    public string TrailSymbolImage { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? CoordinatesJson { get; set; }

    public ICollection<TrailImage>? TrailImages { get; set; }
    public ICollection<Review>? Reviews { get; set; }
    public ICollection<TrailLink>? TrailLinks { get; set; }
}

