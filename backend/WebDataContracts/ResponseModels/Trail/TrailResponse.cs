using WebDataContracts.ResponseModels.Review;

namespace WebDataContracts.ResponseModels.Trail;

public class TrailResponse
{
    public required string Identifier { get; set; }
    public string? Name { get; set; }
    public double? TrailLenght { get; set; }
    public string? Classification { get; set; }
    public bool? Accessability { get; set; }
    public string? AccessabilityInfo { get; set; }
    public string? TrailSymbol { get; set; }
    public string? TrailSymbolImage { get; set; }
    public string? Description { get; set; }
    public string? CoordinatesJson { get; set; }
    public IReadOnlyCollection<TrailImageResponse>? TrailImagesResponse { get; set; }
    public IReadOnlyCollection<TrailLinkResponse>? TrailLinksResponse { get; set; }
    public IReadOnlyCollection<ReviewResponse>? ReviewsResponse { get; set; }

    public static TrailResponse Create(
        string identifier,
        string name,
        double trailLenght,
        string classification,
        bool accessability,
        string accessabilityInfo,
        string trailSymbol,
        string trailSymbolImage,
        string description,
        string coordinatesJson,
        IEnumerable<TrailImageResponse>? trailImages,
        IEnumerable<TrailLinkResponse>? trailLinks,
        IEnumerable<ReviewResponse>? reviews)
    {
        return new TrailResponse
        {
            Identifier = identifier,
            Name = name,
            TrailLenght = trailLenght,
            Classification = classification,
            Accessability = accessability,
            AccessabilityInfo = accessabilityInfo,
            TrailSymbol = trailSymbol,
            TrailSymbolImage = trailSymbolImage,
            Description = description,
            CoordinatesJson = coordinatesJson,
            TrailImagesResponse = trailImages?.ToList(),
            TrailLinksResponse = trailLinks?.ToList(),
            ReviewsResponse = reviews?.ToList(),
        };
    }
}

