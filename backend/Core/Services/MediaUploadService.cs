using Core.Interfaces.Services;
using Microsoft.Extensions.Logging;

namespace Core.Services;

public class MediaUploadService : IMediaUploadService
{
    private readonly IImageProcessingService _imageProcessing;
    private readonly IWebDavService _webDavService;
    private readonly ILogger<MediaUploadService> _logger;

    public MediaUploadService(
        IImageProcessingService imageProcessing,
        IWebDavService webDavService,
        ILogger<MediaUploadService> logger)
    {
        _imageProcessing = imageProcessing;
        _webDavService = webDavService;
        _logger = logger;
    }

    public async Task<Result<UploadedMedia>> ProcessAndUploadAsync(Stream stream, string subDirectory, ImageProcessingOptions options)
    {
        try
        {
            using var processed = _imageProcessing.Process(stream, options);

            var uploadResult = await _webDavService.UploadFileAsync(processed.Stream, subDirectory, processed.Extension);

            if (uploadResult.IsFailure || uploadResult.Value == null)
                return Result.Fail<UploadedMedia>(uploadResult.Message ?? new Message(500, "Failed to upload image."));

            return Result.Ok(new UploadedMedia(uploadResult.Value, processed.Width, processed.Height, processed.SizeBytes));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MediaUploadService: ProcessAndUploadAsync -> failed for subdirectory {SubDirectory}", subDirectory);
            return Result.Fail<UploadedMedia>(new Message(500, "Failed to process and upload image."));
        }
    }
}
