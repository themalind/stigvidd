namespace WebDataContracts.ResponseModels.Media;

public class MediaItemResponse
{
    public required string Identifier { get; set; }
    public required string ImageUrl { get; set; }
    public string? AltText { get; set; }
    public string? Caption { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public long SizeBytes { get; set; }

    /// <summary>"Trail" | "Facility" | "TrailSymbol"</summary>
    public required string OwnerType { get; set; }
    public string? OwnerIdentifier { get; set; }
    public string? OwnerName { get; set; }

    public static MediaItemResponse Create(
        string presentableUrl, string identifier, string imageUrl, string? altText, string? caption,
        int width, int height, long sizeBytes, string ownerType, string? ownerIdentifier, string? ownerName)
    {
        return new MediaItemResponse
        {
            Identifier = identifier,
            ImageUrl = $"{presentableUrl}{imageUrl}",
            AltText = altText,
            Caption = caption,
            Width = width,
            Height = height,
            SizeBytes = sizeBytes,
            OwnerType = ownerType,
            OwnerIdentifier = ownerIdentifier,
            OwnerName = ownerName
        };
    }
}
