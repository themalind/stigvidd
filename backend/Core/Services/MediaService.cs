using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Microsoft.Extensions.Configuration;
using WebDataContracts.ResponseModels.Media;

namespace Core.Services;

public class MediaService : IMediaService
{
    private readonly IMediaRepository _mediaRepository;
    private readonly string _presentableBaseUrl;

    public MediaService(IMediaRepository mediaRepository, IConfiguration configuration)
    {
        _mediaRepository = mediaRepository;
        _presentableBaseUrl = configuration["PresentableBaseUrl"]
            ?? throw new InvalidOperationException("PresentableBaseUrl configuration is missing");
    }

    public async Task<Result<IReadOnlyCollection<MediaItemResponse>>> GetAllMediaAsync(CancellationToken ctoken)
    {
        var result = await _mediaRepository.GetAllMediaAsync(ctoken);

        if (!result.IsSuccess)
            return Result.Fail<IReadOnlyCollection<MediaItemResponse>>(new Message(500, "An error occurred while fetching media."));

        IReadOnlyCollection<MediaItemResponse> response = result.Value
            .Select(m => MediaItemResponse.Create(
                _presentableBaseUrl, m.Identifier, m.ImageUrl, m.AltText, m.Caption,
                m.Width, m.Height, m.SizeBytes, m.OwnerType, m.OwnerIdentifier, m.OwnerName))
            .ToList();

        return Result.Ok(response);
    }

    public async Task<Result> UpdateImageMetadataAsync(string imageIdentifier, string? altText, string? caption, CancellationToken ctoken)
    {
        var result = await _mediaRepository.UpdateImageMetadataAsync(imageIdentifier, altText, caption, ctoken);

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail(new Message(500, "An error occurred while updating image metadata."));

        if (!result.IsSuccess)
            return Result.Fail(new Message(404, $"Image with identifier {imageIdentifier} not found."));

        return Result.Ok();
    }
}
