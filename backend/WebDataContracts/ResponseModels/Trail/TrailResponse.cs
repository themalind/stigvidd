namespace WebDataContracts.ResponseModels.Trail;

public class TrailResponse
{
    public required string Identifier { get; set; }
    public string? Name { get; set; }
    public decimal? TrailLenght { get; set; }
    public int? Classification { get; set; }
    public bool? Accessibility { get; set; }
    public string? AccessibilityInfo { get; set; }
    public string? TrailSymbol { get; set; }
    public string? TrailSymbolImage { get; set; }
    public string? Description { get; set; }
    public string? FullDescription { get; set; }
    public string? Coordinates { get; set; }
    public string? Tags { get; set; }
    public string? CreatedBy { get; set; }
    public bool IsVerified { get; set; } = false;
    public string? City { get; set; }

    public VisitorInformationResponse? VisitorInformation { get; set; }
    public IReadOnlyCollection<TrailImageResponse>? TrailImagesResponse { get; set; }
    public IReadOnlyCollection<TrailLinkResponse>? TrailLinksResponse { get; set; }

    public static TrailResponse Create(
        string identifier,
        string name,
        decimal trailLenght,
        int classification,
        bool accessibility,
        string accessibilityInfo,
        string trailSymbol,
        string trailSymbolImage,
        string description,
        string fullDescription,
        string coordinates,
        string tags,
        string createdBy,
        bool isVerified,
        string city,
        IEnumerable<TrailImageResponse>? trailImages,
        IEnumerable<TrailLinkResponse>? trailLinks,
        VisitorInformationResponse? visitorInformationResponse)

    {
        return new TrailResponse
        {
            Identifier = identifier,
            Name = name,
            TrailLenght = trailLenght,
            Classification = classification,
            Accessibility = accessibility,
            AccessibilityInfo = accessibilityInfo,
            TrailSymbol = trailSymbol,
            TrailSymbolImage = trailSymbolImage,
            Description = description,
            FullDescription = fullDescription,
            Coordinates = coordinates,
            Tags = tags,
            CreatedBy = createdBy,
            IsVerified = isVerified,
            City = city,
            TrailImagesResponse = trailImages?.ToList(),
            TrailLinksResponse = trailLinks?.ToList(),
            VisitorInformation = visitorInformationResponse
        };
    }

    public static TrailResponse Create(
       string identifier,
       string name,
       decimal trailLenght,
       int classification,
       bool accessibility,
       string accessibilityInfo,
       string trailSymbol,
       string trailSymbolImage,
       string description,
       string fullDescription,
       string tags,
       string createdBy,
       bool isVerified,
       string city,
       IEnumerable<TrailImageResponse>? trailImages,
       IEnumerable<TrailLinkResponse>? trailLinks,
       VisitorInformationResponse? visitorInformationResponse)

    {
        return new TrailResponse
        {
            Identifier = identifier,
            Name = name,
            TrailLenght = trailLenght,
            Classification = classification,
            Accessibility = accessibility,
            AccessibilityInfo = accessibilityInfo,
            TrailSymbol = trailSymbol,
            TrailSymbolImage = trailSymbolImage,
            Description = description,
            FullDescription = fullDescription,
            Tags = tags,
            CreatedBy = createdBy,
            IsVerified = isVerified,
            City = city,
            TrailImagesResponse = trailImages?.ToList(),
            TrailLinksResponse = trailLinks?.ToList(),
            VisitorInformation = visitorInformationResponse
        };
    }
}

