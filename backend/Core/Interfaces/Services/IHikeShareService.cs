namespace Core.Interfaces.Services;

public interface IHikeShareService
{
    // ByUser = you are the owner who shared.
    Task<Result<int>> GetHikeShareCountAsync(string identifier, string hikeIdentifier, CancellationToken ctoken);
    Task<Result> ShareHikeAsync(string identifier, string hikeIdentifier, string sharedWithName, CancellationToken ctoken);
}
