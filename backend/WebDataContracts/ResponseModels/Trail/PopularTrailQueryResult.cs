namespace WebDataContracts.ResponseModels.Trail;

public class PopularTrailQueryResult
{
    public int Id { get; set; }
    public required string Identifier { get; set; }
    public required string Name { get; set; }
    public decimal TrailLength { get; set; }
    public decimal AverageRating { get; set; }
    public double? StartLatitude { get; set; }
    public double? StartLongitude { get; set; }
}
