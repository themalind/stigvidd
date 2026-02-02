namespace WebDataContracts.RequestModels.Trail;

public class CreateTrailRequest
{
    public required string Name { get; set; }
    public required double TrailLength { get; set; }
    public string? Classification { get; set; }
    public bool? Accessability { get; set; }
    public string? AccessabilityInfo { get; set; }
    public string? TrailSymbol { get; set; }
    public string? TrailSymbolImage { get; set; }
    public string? Description { get; set; }
    public required string Coordinates { get; set; }
}