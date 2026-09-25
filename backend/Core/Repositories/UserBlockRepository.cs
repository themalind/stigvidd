// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Linq.Expressions;

namespace Core.Repositories;

public class UserBlockRepository : IUserBlockRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _context;
    private readonly ILogger<UserBlockRepository> _logger;

    public UserBlockRepository(IDbContextFactory<StigViddDbContext> context, ILogger<UserBlockRepository> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<RepositoryResult> BlockAsync(int blockerUserId, int blockedUserId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var exists = await context.UserBlocks
                .AnyAsync(ub => ub.BlockerUserId == blockerUserId && ub.BlockedUserId == blockedUserId, ctoken);

            if (exists)
                return RepositoryResult.Success();

            context.UserBlocks.Add(new UserBlock
            {
                BlockerUserId = blockerUserId,
                BlockedUserId = blockedUserId,
            });

            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (DbUpdateException ex)
        {
            var blocked = await HasBlockedAsync(blockerUserId, blockedUserId, ctoken);

            if (blocked.IsSuccess && blocked.Value)
                return RepositoryResult.Success();

            _logger.LogError(ex, "Error blocking user {BlockedUserId} for user {BlockerUserId}", blockedUserId, blockerUserId);
            return RepositoryResult.Error();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error blocking user {BlockedUserId} for user {BlockerUserId}", blockedUserId, blockerUserId);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult> UnblockAsync(int blockerUserId, int blockedUserId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var block = await context.UserBlocks
                .FirstOrDefaultAsync(ub => ub.BlockerUserId == blockerUserId && ub.BlockedUserId == blockedUserId, ctoken);

            if (block == null)
                return RepositoryResult.NotFound();

            context.UserBlocks.Remove(block);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error unblocking user {BlockedUserId} for user {BlockerUserId}", blockedUserId, blockerUserId);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult<bool>> HasBlockedAsync(int blockerUserId, int blockedUserId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var blocked = await context.UserBlocks
                .AnyAsync(ub => ub.BlockerUserId == blockerUserId && ub.BlockedUserId == blockedUserId, ctoken);

            return RepositoryResult<bool>.Success(blocked);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking whether user {BlockerUserId} blocks {BlockedUserId}", blockerUserId, blockedUserId);
            return RepositoryResult<bool>.Error();
        }
    }

    public async Task<RepositoryResult<int[]>> GetHiddenUserIdsAsync(int userId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var hidden = await context.UserBlocks
                .Where(ub => ub.BlockerUserId == userId)
                .Select(ub => ub.BlockedUserId)
                .ToArrayAsync(ctoken);

            return RepositoryResult<int[]>.Success(hidden);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reading hidden users for user {UserId}", userId);
            return RepositoryResult<int[]>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyCollection<T>>> GetBlockedByUserAsync<T>(
        int userId, Expression<Func<UserBlock, User, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var blocked = await context.UserBlocks
                .Where(ub => ub.BlockerUserId == userId)
                .OrderByDescending(ub => ub.CreatedAt)
                .Join(context.Users, ub => ub.BlockedUserId, u => u.Id, selector)
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<T>>.Success(blocked);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reading the blocked list for user {UserId}", userId);
            return RepositoryResult<IReadOnlyCollection<T>>.Error();
        }
    }
}
