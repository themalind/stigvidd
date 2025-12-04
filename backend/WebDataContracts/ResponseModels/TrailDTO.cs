namespace WebDataContracts.ResponseModels;

public class TrailDTO
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
    public IReadOnlyCollection<TrailImageDTO>? TrailImageDTO { get; set; }
    public IReadOnlyCollection<TrailLinkDTO>? TrailLinkDTO { get; set; }
    public IReadOnlyCollection<ReviewDTO>? ReviewDTO { get; set; }

    public static TrailDTO Create(
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
        IEnumerable<TrailImageDTO>? trailImagesDTO,
        IEnumerable<TrailLinkDTO>? trailLinksDTO,
        IEnumerable<ReviewDTO>? reviewDTOs)
    {
        return new TrailDTO
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
            TrailImageDTO = trailImagesDTO?.ToList(),
            TrailLinkDTO = trailLinksDTO?.ToList(),
            ReviewDTO = reviewDTOs?.ToList(),
        };
    }
}

