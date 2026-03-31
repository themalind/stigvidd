namespace WebDataContracts.ResponseModels.Trail;

public class TrailMarkerResponse
{
    public required string Identifier { get; set; }
    public required string Name { get; set; }
    public decimal? StartLatitude { get; set; }
    public decimal? StartLongitude { get; set; }
}