// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Repositories;

public class PasswordResetTokenRepository : IPasswordResetTokenRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _dbContextFactory;
    private readonly ILogger<PasswordResetTokenRepository> _logger;

    public PasswordResetTokenRepository(
        IDbContextFactory<StigViddDbContext> dbContextFactory,
        ILogger<PasswordResetTokenRepository> logger)
    {
        _dbContextFactory = dbContextFactory;
        _logger = logger;
    }

    public async Task<RepositoryResult<User>> GetUserByEmailAsync(string email, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            // Case-insensitive: Keycloak lower-cases the address it stores, and a user typing
            // their own address back with different capitalisation is not a different person.
            var normalized = email.Trim().ToLowerInvariant();

            var user = await context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Email.ToLower() == normalized, ctoken);

            return user is null
                ? RepositoryResult<User>.NotFound()
                : RepositoryResult<User>.Success(user);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "PasswordResetTokenRepository: GetUserByEmailAsync -> Something went wrong when looking up a user by email.");
            return RepositoryResult<User>.Error();
        }
    }

    public async Task<RepositoryResult> ReplaceOutstandingAsync(PasswordResetToken token, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var now = DateTime.UtcNow;

            var outstanding = await context.PasswordResetTokens
                .Where(t => t.UserId == token.UserId && t.ConsumedAt == null)
                .ToListAsync(ctoken);

            foreach (var previous in outstanding)
            {
                previous.ConsumedAt = now;
                previous.LastUpdatedAt = now;
            }

            context.PasswordResetTokens.Add(token);

            // One save: retiring the old links and issuing the new one must not be separable,
            // or a crash between them leaves two live links or none.
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "PasswordResetTokenRepository: ReplaceOutstandingAsync -> Something went wrong when issuing a password reset token for user {userId}.", token.UserId);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult<PasswordResetToken>> GetByTokenHashAsync(string tokenHash, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var token = await context.PasswordResetTokens
                .AsNoTracking()
                .Include(t => t.User)
                .FirstOrDefaultAsync(t => t.TokenHash == tokenHash, ctoken);

            return token is null
                ? RepositoryResult<PasswordResetToken>.NotFound()
                : RepositoryResult<PasswordResetToken>.Success(token);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "PasswordResetTokenRepository: GetByTokenHashAsync -> Something went wrong when looking up a password reset token.");
            return RepositoryResult<PasswordResetToken>.Error();
        }
    }

    public async Task<RepositoryResult<PasswordResetToken>> GetLatestForUserAsync(int userId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var token = await context.PasswordResetTokens
                .AsNoTracking()
                .Include(t => t.User)
                .Where(t => t.UserId == userId)
                .OrderByDescending(t => t.CreatedAt)
                .ThenByDescending(t => t.Id)
                .FirstOrDefaultAsync(ctoken);

            return token is null
                ? RepositoryResult<PasswordResetToken>.NotFound()
                : RepositoryResult<PasswordResetToken>.Success(token);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "PasswordResetTokenRepository: GetLatestForUserAsync -> Something went wrong when looking up the latest password reset token for user {userId}.", userId);
            return RepositoryResult<PasswordResetToken>.Error();
        }
    }

    public async Task<RepositoryResult> ConsumeAsync(int tokenId, DateTime consumedAt, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var token = await context.PasswordResetTokens
                .FirstOrDefaultAsync(t => t.Id == tokenId, ctoken);

            if (token is null)
                return RepositoryResult.NotFound();

            token.ConsumedAt = consumedAt;
            token.LastUpdatedAt = consumedAt;

            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "PasswordResetTokenRepository: ConsumeAsync -> Something went wrong when consuming password reset token {tokenId}.", tokenId);
            return RepositoryResult.Error();
        }
    }
}
