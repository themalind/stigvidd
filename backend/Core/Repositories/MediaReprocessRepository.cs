// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Linq.Expressions;

namespace Core.Repositories;

public class MediaReprocessRepository : IMediaReprocessRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _dbContextFactory;
    private readonly ILogger<MediaReprocessRepository> _logger;

    public MediaReprocessRepository(
        IDbContextFactory<StigViddDbContext> dbContextFactory, ILogger<MediaReprocessRepository> logger)
    {
        _dbContextFactory = dbContextFactory;
        _logger = logger;
    }

    public async Task<RepositoryResult<MediaReprocessJob>> CreateJobAsync(
        string optionsJson,
        IReadOnlyCollection<(string MediaIdentifier, string OwnerType)> targets,
        CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var job = new MediaReprocessJob
            {
                OptionsJson = optionsJson,
                Items = targets
                    .Select(t => new MediaReprocessItem
                    {
                        MediaIdentifier = t.MediaIdentifier,
                        OwnerType = t.OwnerType,
                        Status = MediaReprocessItemStatus.Pending,
                    })
                    .ToList(),
            };

            context.MediaReprocessJobs.Add(job);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<MediaReprocessJob>.Success(job);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MediaReprocessRepository: CreateJobAsync -> Something went wrong when creating a batch reprocess job.");
            return RepositoryResult<MediaReprocessJob>.Error();
        }
    }

    public async Task<RepositoryResult<MediaReprocessItem>> ClaimAsync(int itemId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var item = await context.MediaReprocessItems
                .Include(i => i.Job)
                .FirstOrDefaultAsync(i => i.Id == itemId, ctoken);

            if (item is null)
                return RepositoryResult<MediaReprocessItem>.NotFound();

            if (item.Status != MediaReprocessItemStatus.Pending)
                return RepositoryResult<MediaReprocessItem>.Conflict();

            item.Status = MediaReprocessItemStatus.Processing;
            item.LastUpdatedAt = DateTime.UtcNow;

            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<MediaReprocessItem>.Success(item);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MediaReprocessRepository: ClaimAsync -> Something went wrong when claiming item {id}.", itemId);
            return RepositoryResult<MediaReprocessItem>.Error();
        }
    }

    public async Task<RepositoryResult<MediaReprocessSuccess>> MarkSucceededAsync(
        int itemId, string oldImageUrl, string newImageUrl, int width, int height, long sizeBytes, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var item = await context.MediaReprocessItems.FirstOrDefaultAsync(i => i.Id == itemId, ctoken);
            if (item is null)
                return RepositoryResult<MediaReprocessSuccess>.NotFound();

            var now = DateTime.UtcNow;
            var oldPaths = SpellingsOf(oldImageUrl);

            // keep-comment: every row on the old file moves, not only this item's - repointing one row and then deleting the file it shared broke ~700 images in one production batch
            // keep-comment: see docs/notes/media-files-are-shared-by-many-image-rows.md
            var trailImages = await context.TrailImages
                .Where(ti => oldPaths.Contains(ti.ImageUrl) || (item.OwnerType == "Trail" && ti.Identifier == item.MediaIdentifier))
                .ToListAsync(ctoken);

            var facilityImages = await context.FacilityImages
                .Where(fi => oldPaths.Contains(fi.ImageUrl) || (item.OwnerType == "Facility" && fi.Identifier == item.MediaIdentifier))
                .ToListAsync(ctoken);

            // keep-comment: no row left means the image was deleted mid-batch - NotFound lets the caller drop the upload instead of recording a success that moved nothing
            if (trailImages.Count + facilityImages.Count == 0)
                return RepositoryResult<MediaReprocessSuccess>.NotFound();

            foreach (var image in trailImages)
            {
                image.ImageUrl = newImageUrl;
                image.Width = width;
                image.Height = height;
                image.SizeBytes = sizeBytes;
                image.LastUpdatedAt = now;
            }

            foreach (var image in facilityImages)
            {
                image.ImageUrl = newImageUrl;
                image.Width = width;
                image.Height = height;
                image.SizeBytes = sizeBytes;
                image.LastUpdatedAt = now;
            }

            var siblingIdentifiers = trailImages.Select(ti => ti.Identifier)
                .Concat(facilityImages.Select(fi => fi.Identifier))
                .Where(identifier => identifier != item.MediaIdentifier)
                .ToList();

            // keep-comment: a sibling's row already points at the new file, so reprocessing it would re-encode the output and delete it - settle it instead: any unsettled item in this job, and Pending items in other jobs (their Failed/Cancelled records are another run's history)
            var siblingItems = await context.MediaReprocessItems
                .Where(i => i.Id != item.Id
                            && siblingIdentifiers.Contains(i.MediaIdentifier)
                            && (i.JobId == item.JobId
                                ? i.Status != MediaReprocessItemStatus.Processing && i.Status != MediaReprocessItemStatus.Succeeded
                                : i.Status == MediaReprocessItemStatus.Pending))
                .ToListAsync(ctoken);

            foreach (var sibling in siblingItems)
            {
                sibling.Status = MediaReprocessItemStatus.Succeeded;
                sibling.LastError = null;
                sibling.LastUpdatedAt = now;
            }

            item.Status = MediaReprocessItemStatus.Succeeded;
            item.LastError = null;
            item.LastUpdatedAt = now;

            await context.SaveChangesAsync(ctoken);

            var stillReferenced =
                await context.HikeImages.AnyAsync(hi => oldPaths.Contains(hi.ImageUrl), ctoken)
                || await context.ReviewImages.AnyAsync(ri => oldPaths.Contains(ri.ImageUrl), ctoken)
                || await context.CityAreas.AnyAsync(ca => ca.ImageUrl != null && oldPaths.Contains(ca.ImageUrl), ctoken)
                || await context.Trails.AnyAsync(t => oldPaths.Contains(t.TrailSymbolImage), ctoken);

            return RepositoryResult<MediaReprocessSuccess>.Success(
                new MediaReprocessSuccess(trailImages.Count + facilityImages.Count, stillReferenced));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MediaReprocessRepository: MarkSucceededAsync -> Something went wrong when marking item {id} succeeded.", itemId);
            return RepositoryResult<MediaReprocessSuccess>.Error();
        }
    }

    // keep-comment: production rows store some paths with a leading "/" (e.g. "/trails/hedared_20260524_1.jpg") and others without, so one file can have two spellings
    private static List<string> SpellingsOf(string path)
    {
        var relative = path.TrimStart('/');
        return [relative, "/" + relative];
    }

    public async Task<RepositoryResult> MarkFailedAsync(int itemId, string error, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var item = await context.MediaReprocessItems.FirstOrDefaultAsync(i => i.Id == itemId, ctoken);
            if (item is null)
                return RepositoryResult.NotFound();

            item.Status = MediaReprocessItemStatus.Failed;
            item.LastError = error;
            item.LastUpdatedAt = DateTime.UtcNow;

            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MediaReprocessRepository: MarkFailedAsync -> Something went wrong when recording a failure for item {id}.", itemId);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult<int>> ResetInterruptedAsync(CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var interrupted = await context.MediaReprocessItems
                .Where(i => i.Status == MediaReprocessItemStatus.Processing)
                .ToListAsync(ctoken);

            foreach (var item in interrupted)
            {
                item.Status = MediaReprocessItemStatus.Pending;
                item.LastUpdatedAt = DateTime.UtcNow;
            }

            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<int>.Success(interrupted.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MediaReprocessRepository: ResetInterruptedAsync -> Something went wrong when resetting interrupted items.");
            return RepositoryResult<int>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyCollection<int>>> GetPendingItemIdsAsync(CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var ids = await context.MediaReprocessItems
                .AsNoTracking()
                .Where(i => i.Status == MediaReprocessItemStatus.Pending)
                .OrderBy(i => i.Id)
                .Select(i => i.Id)
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<int>>.Success(ids);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MediaReprocessRepository: GetPendingItemIdsAsync -> Something went wrong when listing pending items.");
            return RepositoryResult<IReadOnlyCollection<int>>.Error();
        }
    }

    public async Task<RepositoryResult<int>> CancelPendingItemsAsync(string jobIdentifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var job = await context.MediaReprocessJobs
                .AsNoTracking()
                .FirstOrDefaultAsync(j => j.Identifier == jobIdentifier, ctoken);

            if (job is null)
                return RepositoryResult<int>.NotFound();

            var pending = await context.MediaReprocessItems
                .Where(i => i.JobId == job.Id && i.Status == MediaReprocessItemStatus.Pending)
                .ToListAsync(ctoken);

            foreach (var item in pending)
            {
                item.Status = MediaReprocessItemStatus.Cancelled;
                item.LastUpdatedAt = DateTime.UtcNow;
            }

            if (pending.Count > 0)
                await context.SaveChangesAsync(ctoken);

            return RepositoryResult<int>.Success(pending.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MediaReprocessRepository: CancelPendingItemsAsync -> Something went wrong when cancelling job {identifier}.", jobIdentifier);
            return RepositoryResult<int>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyCollection<int>>> RetryFailedItemsAsync(string jobIdentifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var job = await context.MediaReprocessJobs
                .AsNoTracking()
                .FirstOrDefaultAsync(j => j.Identifier == jobIdentifier, ctoken);

            if (job is null)
                return RepositoryResult<IReadOnlyCollection<int>>.NotFound();

            var failed = await context.MediaReprocessItems
                .Where(i => i.JobId == job.Id && i.Status == MediaReprocessItemStatus.Failed)
                .OrderBy(i => i.Id)
                .ToListAsync(ctoken);

            foreach (var item in failed)
            {
                item.Status = MediaReprocessItemStatus.Pending;
                item.LastError = null;
                item.LastUpdatedAt = DateTime.UtcNow;
            }

            if (failed.Count > 0)
                await context.SaveChangesAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<int>>.Success(failed.Select(i => i.Id).ToList());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MediaReprocessRepository: RetryFailedItemsAsync -> Something went wrong when retrying job {identifier}.", jobIdentifier);
            return RepositoryResult<IReadOnlyCollection<int>>.Error();
        }
    }

    public async Task<RepositoryResult<PagedResult<MediaReprocessJobCounts>>> GetJobsPagedAsync(
        int page, int pageSize, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var query = context.MediaReprocessJobs.AsNoTracking();

            var total = await query.CountAsync(ctoken);

            var items = await query
                .OrderByDescending(j => j.CreatedAt)
                .ThenByDescending(j => j.Id)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(ToCounts)
                .ToListAsync(ctoken);

            return RepositoryResult<PagedResult<MediaReprocessJobCounts>>.Success(
                new PagedResult<MediaReprocessJobCounts>(items, page, (page * pageSize) < total, total));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MediaReprocessRepository: GetJobsPagedAsync -> Something went wrong when listing batch reprocess jobs.");
            return RepositoryResult<PagedResult<MediaReprocessJobCounts>>.Error();
        }
    }

    public async Task<RepositoryResult<MediaReprocessJobCounts>> GetJobCountsAsync(string identifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var counts = await context.MediaReprocessJobs
                .AsNoTracking()
                .Where(j => j.Identifier == identifier)
                .Select(ToCounts)
                .FirstOrDefaultAsync(ctoken);

            return counts is null
                ? RepositoryResult<MediaReprocessJobCounts>.NotFound()
                : RepositoryResult<MediaReprocessJobCounts>.Success(counts);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MediaReprocessRepository: GetJobCountsAsync -> Something went wrong when reading job {identifier}.", identifier);
            return RepositoryResult<MediaReprocessJobCounts>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyCollection<MediaReprocessItemDetail>>> GetJobItemsAsync(
        string jobIdentifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var job = await context.MediaReprocessJobs
                .AsNoTracking()
                .FirstOrDefaultAsync(j => j.Identifier == jobIdentifier, ctoken);

            if (job is null)
                return RepositoryResult<IReadOnlyCollection<MediaReprocessItemDetail>>.NotFound();

            var items = await context.MediaReprocessItems
                .AsNoTracking()
                .Where(i => i.JobId == job.Id)
                .OrderBy(i => i.Id)
                .Select(i => new MediaReprocessItemDetail(
                    i.Identifier, i.MediaIdentifier, i.OwnerType, i.Status, i.LastError, i.CreatedAt, i.LastUpdatedAt))
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<MediaReprocessItemDetail>>.Success(items);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MediaReprocessRepository: GetJobItemsAsync -> Something went wrong when reading job {identifier}'s items.", jobIdentifier);
            return RepositoryResult<IReadOnlyCollection<MediaReprocessItemDetail>>.Error();
        }
    }

    // keep-comment: Public so a unit test can assert it directly — ExecuteDeleteAsync below isn't supported
    // keep-comment: by the EF InMemory provider the unit suite runs on.
    public static Expression<Func<MediaReprocessJob, bool>> PurgeableSettled(DateTime cutoffUtc) =>
        j => j.CreatedAt < cutoffUtc
             && j.Items.All(i => i.Status != MediaReprocessItemStatus.Pending
                                  && i.Status != MediaReprocessItemStatus.Processing);

    public async Task<RepositoryResult<int>> PurgeSettledJobsBeforeAsync(DateTime cutoffUtc, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var deleted = await context.MediaReprocessJobs
                .Where(PurgeableSettled(cutoffUtc))
                .ExecuteDeleteAsync(ctoken);

            return RepositoryResult<int>.Success(deleted);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MediaReprocessRepository: PurgeSettledJobsBeforeAsync -> Something went wrong when purging settled jobs.");
            return RepositoryResult<int>.Error();
        }
    }

    // keep-comment: Expression, not a compiled method, so EF can translate it when passed to .Select().
    private static readonly Expression<Func<MediaReprocessJob, MediaReprocessJobCounts>> ToCounts = j => new MediaReprocessJobCounts(
        j.Identifier,
        j.OptionsJson,
        j.Items.Count,
        j.Items.Count(i => i.Status == MediaReprocessItemStatus.Pending),
        j.Items.Count(i => i.Status == MediaReprocessItemStatus.Processing),
        j.Items.Count(i => i.Status == MediaReprocessItemStatus.Succeeded),
        j.Items.Count(i => i.Status == MediaReprocessItemStatus.Failed),
        j.Items.Count(i => i.Status == MediaReprocessItemStatus.Cancelled),
        j.CreatedAt,
        j.LastUpdatedAt);
}
