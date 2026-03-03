namespace WebDataContracts.RequestModels.Trail;

public class CreateTrailRequest
{
    public required string Name { get; set; }
    public required decimal TrailLength { get; set; }
    public int? Classification { get; set; }
    public bool? Accessibility { get; set; }
    public string? AccessibilityInfo { get; set; }
    public string? TrailSymbol { get; set; }
    public string? TrailSymbolImage { get; set; }
    public string? Description { get; set; }
    public string? FullDescription { get; set; }
    public required string Coordinates { get; set; }
    public string? Tags { get; set; }
    public bool? IsVerified { get; set; }
    public string? City { get; set; }
}