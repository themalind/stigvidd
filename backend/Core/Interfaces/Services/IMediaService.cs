using WebDataContracts.ResponseModels.Media;

namespace Core.Interfaces.Services;

public interface IMediaService
{
    Task<Result<IReadOnlyCollection<MediaItemResponse>>> GetAllMediaAsync(CancellationToken ctoken);
    Task<Result> UpdateImageMetadataAsync(string imageIdentifier, string? altText, string? caption, CancellationToken ctoken);
}
