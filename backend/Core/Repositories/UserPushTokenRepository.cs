using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Repositories;

public class UserPushTokenRepository : IUserPushTokenRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _dbContextFactory;
    private readonly ILogger<UserPushTokenRepository> _logger;

    public UserPushTokenRepository(IDbContextFactory<StigViddDbContext> dbContextFactory, ILogger<UserPushTokenRepository> logger)
    {
        _dbContextFactory = dbContextFactory;
        _logger = logger;
    }

    public async Task<RepositoryResult<UserPushToken?>> GetByTokenAndUserAsync(string expoToken, int userId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var token = await context.UserPushTokens
                .FirstOrDefaultAsync(t => t.ExpoToken == expoToken && t.UserId == userId, ctoken);

            return RepositoryResult<UserPushToken?>.Success(token);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving push token {ExpoToken} for user {UserId}", expoToken, userId);
            return RepositoryResult<UserPushToken?>.Error();
        }
    }

    public async Task<RepositoryResult> DeleteByTokenAsync(string expoToken, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var token = await context.UserPushTokens
                .FirstOrDefaultAsync(t => t.ExpoToken == expoToken, ctoken);

            if (token == null)
            {
                return RepositoryResult.Error();
            }

            context.UserPushTokens.Remove(token);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting push token {ExpoToken}", expoToken);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult<IEnumerable<UserPushToken>>> GetTokensForUserAsync(int userId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var tokens = await context.UserPushTokens
                .Where(t => t.UserId == userId)
                .ToListAsync(ctoken);

            return RepositoryResult<IEnumerable<UserPushToken>>.Success(tokens);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving push tokens for user {UserId}", userId);
            return RepositoryResult<IEnumerable<UserPushToken>>.Error();
        }
    }

    public async Task<RepositoryResult> UpsertAsync(int userId, string expoToken, string platform, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var token = await context.UserPushTokens
                .FirstOrDefaultAsync(t => t.ExpoToken == expoToken, ctoken);

            if (token == null)
            {
                // Create new token
                token = new UserPushToken
                {
                    ExpoToken = expoToken,
                    UserId = userId,
                    Platform = platform
                };
                context.UserPushTokens.Add(token);
            }
            else
            {
                // Update existing token
                token.Platform = platform;
            }

            await context.SaveChangesAsync(ctoken);
            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error upserting push token {ExpoToken} for user {UserId}", expoToken, userId);
            return RepositoryResult.Error();
        }
    }    
}
