namespace WebDataContracts.ResponseModels.Trail;

public class TrailCardResponse
{
    public required string Identifier { get; set; }
    public required string Name { get; set; }
    public decimal TrailLength { get; set; }
    public int Classification { get; set; }
    public bool IsAccessible { get; set; }
    public decimal AverageRating { get; set; }
    public TrailImageResponse? Image { get; set; }

    public static TrailCardResponse Create(
        string identifier,
        string name,
        decimal trailLength,
        int classification,
        bool isAccessible,
        decimal averageRating,
        TrailImageResponse? image)
    {
        return new TrailCardResponse
        {
            Identifier = identifier,
            Name = name,
            TrailLength = trailLength,
            Classification = classification,
            IsAccessible = isAccessible,
            AverageRating = averageRating,
            Image = image
        };
    }
}
