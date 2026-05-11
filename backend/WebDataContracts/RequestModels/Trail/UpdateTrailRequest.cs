namespace WebDataContracts.RequestModels.Trail;

public class UpdateTrailRequest
{
    public required string Name { get; set; }
    public required decimal TrailLength { get; set; }
    public int? Classification { get; set; }
    public bool? Accessibility { get; set; }
    public string? AccessibilityInfo { get; set; }
    public string? TrailSymbol { get; set; }
    public string? Description { get; set; }
    public string? FullDescription { get; set; }
    public string? Tags { get; set; }
    public string? City { get; set; }
}
