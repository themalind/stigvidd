namespace WebDataContracts.ResponseModels.Trail;

public class TrailImageResponse
{
    public required string Identifier { get; set; }
    public required string ImageUrl { get; set; }
    public string? AltText { get; set; }
    public string? Caption { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public long SizeBytes { get; set; }

    public static TrailImageResponse Create(string presentableUrl, string identifier, string imageUrl)
    {
        return new TrailImageResponse
        {
            Identifier = identifier,
            ImageUrl = $"{presentableUrl}{imageUrl}"
        };
    }

    public static TrailImageResponse Create(
        string presentableUrl, string identifier, string imageUrl,
        string? altText, string? caption, int width, int height, long sizeBytes)
    {
        return new TrailImageResponse
        {
            Identifier = identifier,
            ImageUrl = $"{presentableUrl}{imageUrl}",
            AltText = altText,
            Caption = caption,
            Width = width,
            Height = height,
            SizeBytes = sizeBytes
        };
    }
}

