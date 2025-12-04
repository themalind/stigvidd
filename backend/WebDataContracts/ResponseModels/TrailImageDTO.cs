namespace WebDataContracts.ResponseModels;

public class TrailImageDTO
{
    public required string Identifier { get; set; }
    public string? ImageUrl { get; set; }
    public int TrailId { get; set; }

    public static TrailImageDTO Create(string identifier, string? imageUrl, int trailId)
    {
        return new TrailImageDTO
        {
            Identifier = identifier,
            ImageUrl = imageUrl,
            TrailId = trailId
        };
    }
}

