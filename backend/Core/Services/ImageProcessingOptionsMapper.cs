using Core.Interfaces.Services;
using WebDataContracts.RequestModels.Media;

namespace Core.Services;

public static class ImageProcessingOptionsMapper
{
    public static ImageProcessingOptions ToOptions(this ImageProcessingOptionsRequest? request)
    {
        if (request == null)
            return new ImageProcessingOptions();

        CropRectangle? crop = null;
        if (request.CropWidth is > 0 && request.CropHeight is > 0)
        {
            crop = new CropRectangle(
                request.CropX ?? 0,
                request.CropY ?? 0,
                request.CropWidth.Value,
                request.CropHeight.Value);
        }

        return new ImageProcessingOptions
        {
            MaxWidth = request.MaxWidth,
            MaxHeight = request.MaxHeight,
            Quality = request.Quality,
            Format = request.Format?.Trim().ToLowerInvariant() switch
            {
                "jpeg" or "jpg" => ImageOutputFormat.Jpeg,
                "webp" => ImageOutputFormat.WebP,
                "png" => ImageOutputFormat.Png,
                _ => ImageOutputFormat.Original
            },
            Crop = crop
        };
    }
}
