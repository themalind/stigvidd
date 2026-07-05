namespace WebDataContracts.RequestModels.Media;

/// <summary>
/// Processing knobs sent alongside an image upload (multipart form fields).
/// All optional — omitting everything stores the image essentially as-is.
/// </summary>
public class ImageProcessingOptionsRequest
{
    public int? MaxWidth { get; set; }
    public int? MaxHeight { get; set; }
    public int? Quality { get; set; }

    /// <summary>"original" | "jpeg" | "webp" | "png"</summary>
    public string? Format { get; set; }

    public int? CropX { get; set; }
    public int? CropY { get; set; }
    public int? CropWidth { get; set; }
    public int? CropHeight { get; set; }
}
