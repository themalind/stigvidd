using Microsoft.AspNetCore.Http;
using WebDataContracts.RequestModels.Trail;
using WebDataContracts.ResponseModels.Trail;

namespace Core.Interfaces.Services;

public interface ITrailService
{
    Task<Result<int>> GetTrailIdByIdentifierAsync(string identifier, CancellationToken ctoken);
    Task<Result<TrailResponse?>> GetTrailByIdentifierWithoutCoordinatesAsync(string identifier, CancellationToken ctoken);
    Task<Result<CoordinatesResponse?>> GetCoordinatesByTrailIdentifierAsync(string identifier, CancellationToken ctoken);
    Task<Result<IReadOnlyCollection<TrailOverviewResponse?>>> GetPopularTrailOverviewsAsync(double? userLatitude, double? userLongitude, CancellationToken ctoken);
    Task<Result<IReadOnlyCollection<TrailMarkerResponse>>> GetAllTrailMarkersAsync(CancellationToken ctoken);
    Task<Result<TrailCardResponse?>> GetTrailCardByIdentifierAsync(string identifier, CancellationToken ctoken);
    Task<Result<IReadOnlyCollection<TrailCardResponse>>> GetTrailCardsByIdentifiersAsync(IReadOnlyCollection<string> identifiers, CancellationToken ctoken);
    Task<Result<TrailResponse?>> AddTrailAsync(CreateTrailRequest request, IFormFile trailSymbolImage, IFormFileCollection TrailImageUrls, string userIdentifier, CancellationToken ctoken);
    Task<Result<TrailResponse?>> UpdateTrailAsync(UpdateTrailRequest request, string trailIdentifier, string userIdentifier, CancellationToken ctoken);
    Task<Result<IReadOnlyCollection<TrailShortInfoResponse>>> GetAllTrailsWithBasicInfoAsync(CancellationToken ctoken);
    Task<Result<IReadOnlyCollection<TrailImageResponse>>> AddTrailImagesAsync(string trailIdentifier, IFormFileCollection images, CancellationToken ctoken);
    Task<Result> DeleteTrailImageAsync(string imageIdentifier, CancellationToken ctoken);
}

