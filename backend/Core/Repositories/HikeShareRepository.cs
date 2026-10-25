// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Core.Repositories;

public class HikeShareRepository : IHikeShareRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _dbContext;
    private readonly ILogger<HikeShareRepository> _logger;

    public HikeShareRepository(IDbContextFactory<StigViddDbContext> dbContext, ILogger<HikeShareRepository> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<RepositoryResult<int>> GetHikeShareCountAsync(string identifier, string hikeIdentifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContext.CreateDbContextAsync(ctoken);

            var count = await context.HikeShares
                .Include(hs => hs.Hike)
                .Where(hs => hs.Hike!.Identifier == hikeIdentifier && hs.Hike.CreatedBy == identifier)
                .CountAsync(ctoken);

            return RepositoryResult<int>.Success(count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeShareRepository: GetHikeShareCountAsync -> Something went wrong when fetching hike share count for hike {hikeIdentifier}.", hikeIdentifier);
            return RepositoryResult<int>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyCollection<SentHikeShare>>> GetHikesSharedByUserAsync(int senderId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContext.CreateDbContextAsync(ctoken);
            var sent = context.HikeShares.Where(hs => hs.SharedById == senderId);

            var hikes = await context.Hikes
                .AsNoTracking()
                .Where(h => sent.Any(hs => hs.HikeId == h.Id))
                .Select(h => new SentHikeShare
                {
                    HikeIdentifier = h.Identifier,
                    HikeName = h.Name,
                    HikeLength = h.HikeLength,
                    Duration = h.Duration,
                    GeoPath = h.GeoPath,
                    IsOwnHike = h.UserId == senderId,
                    ImageUrl = context.HikeImages
                        .Where(i => i.HikeId == h.Id && i.ModerationState == ModerationState.Visible)
                        .OrderBy(i => i.CreatedAt)
                        .Select(i => i.ImageUrl)
                        .FirstOrDefault(),
                    Recipients = sent
                        .Where(hs => hs.HikeId == h.Id)
                        .Join(context.Users, hs => hs.SharedWithId, u => u.Id, (hs, u) => new SentHikeShareRecipient
                        {
                            Identifier = u.Identifier,
                            NickName = u.NickName,
                            SharedAt = hs.CreatedAt,
                        })
                        .ToList(),
                })
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<SentHikeShare>>.Success(hikes);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeShareRepository: GetHikesSharedByUserAsync -> Something went wrong when fetching hikes shared by user {senderId}.", senderId);
            return RepositoryResult<IReadOnlyCollection<SentHikeShare>>.Error();
        }
    }

    public async Task<RepositoryResult<bool>> IsAlreadySharedAsync(int hikeId, int sharedWithId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContext.CreateDbContextAsync(ctoken);
            var exists = await context.HikeShares
                .AnyAsync(hs => hs.HikeId == hikeId && hs.SharedWithId == sharedWithId, ctoken);
            return RepositoryResult<bool>.Success(exists);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeShareRepository: IsAlreadySharedAsync -> Something went wrong when checking if hike {hikeId} is already shared with user {sharedWithId}.", hikeId, sharedWithId);
            return RepositoryResult<bool>.Error();
        }
    }

    public async Task<RepositoryResult> ShareHikesAsync(IReadOnlyCollection<HikeShare> hikeShares, CancellationToken ctoken)
    {
        using var context = await _dbContext.CreateDbContextAsync(ctoken);
        try
        {
            var inserted = await HikeShareInsert.InsertSkippingExistingAsync(context, hikeShares, ctoken);

            if (inserted < hikeShares.Count)
                _logger.LogInformation(
                    "HikeShareRepository: ShareHikesAsync -> A concurrent share already inserted {Skipped} of {Count} rows for hike {HikeId}.",
                    hikeShares.Count - inserted, hikeShares.Count, hikeShares.FirstOrDefault()?.HikeId);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeShareRepository: ShareHikesAsync -> Something went wrong when sharing hike with ID {hikeId} to {count} users.", hikeShares.FirstOrDefault()?.HikeId, hikeShares.Count);
            return RepositoryResult.Error();
        }
    }
}
