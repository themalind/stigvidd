using Microsoft.AspNetCore.Http;
using WebDataContracts.RequestModels.Trail;
using WebDataContracts.ResponseModels.Trail;

namespace Core.Interfaces;

public interface ITrailService
{
    Task<Result<TrailResponse?>> GetTrailByIdentifierAsync(string identifier, CancellationToken ctoken);
    Task<Result<IReadOnlyCollection<TrailOverviewResponse?>>> GetPopularTrailOverviewsAsync(CancellationToken ctoken);
    Task<Result<TrailResponse?>> AddTrailAsync(CreateTrailRequest request, IFormFile trailSymbolImage, IFormFileCollection TrailImageUrls, CancellationToken ctoken);
}

