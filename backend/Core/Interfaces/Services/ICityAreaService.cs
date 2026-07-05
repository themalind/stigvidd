using Microsoft.AspNetCore.Http;
using WebDataContracts.RequestModels.CityArea;
using WebDataContracts.ResponseModels.CityArea;

namespace Core.Interfaces.Services;

public interface ICityAreaService
{
    Task<Result<IReadOnlyCollection<CityAreaResponse>>> GetAllAsync(CancellationToken ctoken);
    Task<Result<CityAreaResponse>> GetByIdentifierAsync(string identifier, CancellationToken ctoken);
    Task<Result> CreateCityAreaAsync(CreateCityAreaRequest createCityAreaRequest, IFormFile? cityAreaImage, CancellationToken ctoken);
    Task<Result> UpdateCityAreaAsync(CityAreaResponse cityAreaResponse, CancellationToken ctoken);
    Task<Result> DeleteCityAreaAsync(string identifier, CancellationToken ctoken);
}
