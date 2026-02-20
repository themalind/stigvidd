namespace Infrastructure.Data.Entities;

public class Trail : BaseEntity
{
    public required string Name { get; set; }
    public required decimal TrailLength { get; set; }
    public int Classification { get; set; } = 0;
    public bool Accessibility { get; set; } = false;
    public string AccessibilityInfo { get; set; } = string.Empty;
    public string TrailSymbol { get; set; } = string.Empty; // Byta namn till trailblaze?
    public string TrailSymbolImage { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string FullDescription { get; set; } = string.Empty;
    public string? Coordinates { get; set; } 
    public string Tags { get; set; } = string.Empty;
    public string? CreatedBy { get; set; } = string.Empty;
    public bool IsVerified { get; set; } = false;
    public string City { get; set; } = string.Empty;

    public VisitorInformation? VisitorInformation { get; set; }
    public ICollection<TrailImage>? TrailImages { get; set; }
    public ICollection<Review>? Reviews { get; set; }
    public ICollection<TrailLink>? TrailLinks { get; set; }
}