using Core.Interfaces.Services;
using ImageMagick;

namespace Core.Services;

public class ImageProcessingService : IImageProcessingService
{
    public ProcessedImage Process(Stream input, ImageProcessingOptions options)
    {
        using var image = new MagickImage(input);

        // Bake in the EXIF orientation before we strip metadata, otherwise phone photos rotate.
        image.AutoOrient();

        if (options.Crop is { } crop && crop.Width > 0 && crop.Height > 0)
        {
            image.Crop(new MagickGeometry(crop.X, crop.Y, (uint)crop.Width, (uint)crop.Height));
            image.ResetPage();
        }

        if (options.MaxWidth is > 0 || options.MaxHeight is > 0)
        {
            var maxW = options.MaxWidth is > 0 ? (uint)options.MaxWidth.Value : image.Width;
            var maxH = options.MaxHeight is > 0 ? (uint)options.MaxHeight.Value : image.Height;

            // Only downscale — never enlarge a smaller source.
            if (image.Width > maxW || image.Height > maxH)
            {
                image.Resize(new MagickGeometry(maxW, maxH) { Greater = true });
            }
        }

        // Drop EXIF/GPS/color-profile bloat.
        image.Strip();

        if (options.Quality is >= 1 and <= 100)
        {
            image.Quality = (uint)options.Quality.Value;
        }

        var targetFormat = options.Format switch
        {
            ImageOutputFormat.Jpeg => MagickFormat.Jpeg,
            ImageOutputFormat.WebP => MagickFormat.WebP,
            ImageOutputFormat.Png => MagickFormat.Png,
            _ => image.Format
        };
        image.Format = targetFormat;

        var output = new MemoryStream();
        image.Write(output);
        output.Position = 0;

        var extension = image.Format.ToString().ToLowerInvariant() switch
        {
            "jpg" => "jpeg",
            var ext => ext
        };

        var contentType = extension switch
        {
            "jpeg" => "image/jpeg",
            "webp" => "image/webp",
            "png" => "image/png",
            "gif" => "image/gif",
            _ => "application/octet-stream"
        };

        return new ProcessedImage
        {
            Stream = output,
            Extension = extension,
            ContentType = contentType,
            Width = (int)image.Width,
            Height = (int)image.Height,
            SizeBytes = output.Length
        };
    }
}
