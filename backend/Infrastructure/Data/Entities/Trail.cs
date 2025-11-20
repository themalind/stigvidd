namespace Infrastructure.Data.Entities;

public class Trail
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public required double TrailLenght { get; set; }
    public string Classification { get; set; } = string.Empty;
    public bool Accessability { get; set; } = false;
    public string AccessabilityInfo { get; set; } = string.Empty;
    public string TrailSymbol { get; set; } = string.Empty;
    public string TrailSymbolImage { get; set; } = string.Empty;

    public Coordinate? Coordinates { get; set; }
    public IReadOnlyCollection<TrailImage>? TrailImages { get; set; }
    public IReadOnlyCollection<TrailLink>? TrailLinks { get; set; }
}

