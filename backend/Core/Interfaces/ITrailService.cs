using Microsoft.AspNetCore.Http;
using WebDataContracts.RequestModels.Trail;
using WebDataContracts.ResponseModels.Trail;

namespace Core.Interfaces;

public interface ITrailService
{
    Task<Result<TrailResponse?>> GetTrailByIdentifierWithoutCoordinatesAsync(string identifier, CancellationToken ctoken);
    Task<Result<CoordinatesResponse?>> GetCoordinatesByTrailIdentifierAsync(string identifier, CancellationToken ctoken);
    Task<Result<IReadOnlyCollection<TrailOverviewResponse?>>> GetPopularTrailOverviewsAsync(double? userLatitude, double? userLongitude, CancellationToken ctoken);
    Task<Result<TrailResponse?>> AddTrailAsync(CreateTrailRequest request, IFormFile trailSymbolImage, IFormFileCollection TrailImageUrls, string userIdentifier, CancellationToken ctoken);
    Task<Result<IReadOnlyCollection<TrailShortInfoResponse>>> GetAllTrailsWithBasicInfoAsync(CancellationToken ctoken);
}

