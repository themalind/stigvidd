namespace Core.Interfaces.Services;

public interface IImageProcessingService
{
    /// <summary>
    /// Applies crop, resize (down-only, aspect preserved), quality and format conversion to the
    /// source image. The returned <see cref="ProcessedImage"/> owns a rewound stream ready to upload.
    /// </summary>
    ProcessedImage Process(Stream input, ImageProcessingOptions options);
}

public enum ImageOutputFormat
{
    Original,
    Jpeg,
    WebP,
    Png
}

public record CropRectangle(int X, int Y, int Width, int Height);

public record ImageProcessingOptions
{
    public int? MaxWidth { get; init; }
    public int? MaxHeight { get; init; }
    public int? Quality { get; init; }
    public ImageOutputFormat Format { get; init; } = ImageOutputFormat.Original;
    public CropRectangle? Crop { get; init; }
}

public sealed class ProcessedImage : IDisposable
{
    public required Stream Stream { get; init; }
    public required string Extension { get; init; }
    public required string ContentType { get; init; }
    public int Width { get; init; }
    public int Height { get; init; }
    public long SizeBytes { get; init; }

    public void Dispose() => Stream.Dispose();
}
