namespace Core.Interfaces.Repositories;

public interface IMediaRepository
{
    Task<RepositoryResult<IReadOnlyCollection<MediaItemProjection>>> GetAllMediaAsync(CancellationToken ctoken);
    Task<RepositoryResult> UpdateImageMetadataAsync(string imageIdentifier, string? altText, string? caption, CancellationToken ctoken);
}

public record MediaItemProjection(
    string Identifier,
    string ImageUrl,
    string? AltText,
    string? Caption,
    int Width,
    int Height,
    long SizeBytes,
    string OwnerType,
    string? OwnerIdentifier,
    string? OwnerName);
