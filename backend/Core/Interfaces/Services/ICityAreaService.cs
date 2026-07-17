using WebDataContracts.ResponseModels.CityArea;

namespace Core.Interfaces.Services;

public interface ICityAreaService
{
    Task<Result<IReadOnlyCollection<CityAreaResponse>>> GetAllAsync(CancellationToken ctoken);
    Task<Result<CityAreaResponse>> GetByIdentifierAsync(string identifier, CancellationToken ctoken);
}
