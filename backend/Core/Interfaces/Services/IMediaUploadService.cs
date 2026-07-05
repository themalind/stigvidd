namespace Core.Interfaces.Services;

/// <summary>
/// Shared pipeline: process an incoming image (resize/compress/convert/crop) and store it on WebDAV.
/// Reused by every domain service that attaches media (trails, trail symbols, facilities, ...).
/// </summary>
public interface IMediaUploadService
{
    Task<Result<UploadedMedia>> ProcessAndUploadAsync(Stream stream, string subDirectory, ImageProcessingOptions options);
}

public record UploadedMedia(string Path, int Width, int Height, long SizeBytes);
