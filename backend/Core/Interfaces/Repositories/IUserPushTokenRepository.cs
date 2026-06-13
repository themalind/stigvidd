using Infrastructure.Data.Entities;

namespace Core.Interfaces.Repositories;

public interface IUserPushTokenRepository
{
    Task<RepositoryResult> UpsertAsync(int userId, string expoToken, string platform, CancellationToken ctoken);
    Task<RepositoryResult<IEnumerable<UserPushToken>>> GetTokensForUserAsync(int userId, CancellationToken ctoken);
    Task<RepositoryResult<UserPushToken?>> GetByTokenAndUserAsync(string expoToken, int userId, CancellationToken ctoken);
    Task<RepositoryResult> DeleteByTokenAsync(string expoToken, CancellationToken ctoken);
}
