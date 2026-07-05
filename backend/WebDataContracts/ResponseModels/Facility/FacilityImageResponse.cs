namespace WebDataContracts.ResponseModels.Facility;

public class FacilityImageResponse
{
    public required string Identifier { get; set; }
    public required string ImageUrl { get; set; }
    public string? AltText { get; set; }
    public string? Caption { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public long SizeBytes { get; set; }

    public static FacilityImageResponse Create(
        string presentableUrl, string identifier, string imageUrl,
        string? altText, string? caption, int width, int height, long sizeBytes)
    {
        return new FacilityImageResponse
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
