// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Repositories;

public class EmailVerificationTokenRepository : IEmailVerificationTokenRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _dbContextFactory;
    private readonly ILogger<EmailVerificationTokenRepository> _logger;

    public EmailVerificationTokenRepository(
        IDbContextFactory<StigViddDbContext> dbContextFactory,
        ILogger<EmailVerificationTokenRepository> logger)
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
            _logger.LogError(ex, "EmailVerificationTokenRepository: GetUserByEmailAsync -> Something went wrong when looking up a user by email.");
            return RepositoryResult<User>.Error();
        }
    }

    public async Task<RepositoryResult> ReplaceOutstandingAsync(EmailVerificationToken token, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var now = DateTime.UtcNow;

            var outstanding = await context.EmailVerificationTokens
                .Where(t => t.UserId == token.UserId && t.ConsumedAt == null)
                .ToListAsync(ctoken);

            foreach (var previous in outstanding)
            {
                previous.ConsumedAt = now;
                previous.LastUpdatedAt = now;
            }

            context.EmailVerificationTokens.Add(token);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EmailVerificationTokenRepository: ReplaceOutstandingAsync -> Something went wrong when issuing a verification token for user {userId}.", token.UserId);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult<EmailVerificationToken>> GetByTokenHashAsync(string tokenHash, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var token = await context.EmailVerificationTokens
                .AsNoTracking()
                .Include(t => t.User)
                .FirstOrDefaultAsync(t => t.TokenHash == tokenHash, ctoken);

            return token is null
                ? RepositoryResult<EmailVerificationToken>.NotFound()
                : RepositoryResult<EmailVerificationToken>.Success(token);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EmailVerificationTokenRepository: GetByTokenHashAsync -> Something went wrong when looking up a verification token.");
            return RepositoryResult<EmailVerificationToken>.Error();
        }
    }

    public async Task<RepositoryResult<EmailVerificationToken>> GetLatestForUserAsync(int userId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var token = await context.EmailVerificationTokens
                .AsNoTracking()
                .Include(t => t.User)
                .Where(t => t.UserId == userId)
                .OrderByDescending(t => t.CreatedAt)
                .ThenByDescending(t => t.Id)
                .FirstOrDefaultAsync(ctoken);

            return token is null
                ? RepositoryResult<EmailVerificationToken>.NotFound()
                : RepositoryResult<EmailVerificationToken>.Success(token);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EmailVerificationTokenRepository: GetLatestForUserAsync -> Something went wrong when looking up the latest verification token for user {userId}.", userId);
            return RepositoryResult<EmailVerificationToken>.Error();
        }
    }

    public async Task<RepositoryResult> ConsumeAsync(int tokenId, DateTime verifiedAt, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var token = await context.EmailVerificationTokens
                .Include(t => t.User)
                .FirstOrDefaultAsync(t => t.Id == tokenId, ctoken);

            if (token is null)
                return RepositoryResult.NotFound();

            token.ConsumedAt = verifiedAt;
            token.LastUpdatedAt = verifiedAt;

            // One save for both, so the row can never be consumed while its user still reads
            // unverified — which would strand the user with no way to ask for another mail.
            if (token.User is not null)
            {
                token.User.EmailVerifiedAt = verifiedAt;
                token.User.LastUpdatedAt = verifiedAt;
            }

            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EmailVerificationTokenRepository: ConsumeAsync -> Something went wrong when consuming verification token {tokenId}.", tokenId);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult<int>> IncrementAttemptsAsync(int tokenId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var token = await context.EmailVerificationTokens
                .FirstOrDefaultAsync(t => t.Id == tokenId, ctoken);

            if (token is null)
                return RepositoryResult<int>.NotFound();

            token.Attempts += 1;
            token.LastUpdatedAt = DateTime.UtcNow;

            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<int>.Success(token.Attempts);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EmailVerificationTokenRepository: IncrementAttemptsAsync -> Something went wrong when counting an attempt against token {tokenId}.", tokenId);
            return RepositoryResult<int>.Error();
        }
    }
}
