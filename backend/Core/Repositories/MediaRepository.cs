// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Linq.Expressions;
using WebDataContracts.RequestModels.Media;

namespace Core.Repositories;

public class MediaRepository : IMediaRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _context;
    private readonly ILogger<MediaRepository> _logger;

    public MediaRepository(IDbContextFactory<StigViddDbContext> context, ILogger<MediaRepository> logger)
    {
        _context = context;
        _logger = logger;
    }

    // keep-comment: an expression rather than inline LINQ so it can be tested over a hand-built array, since Tests/UnitTests is EF InMemory and proves nothing about the query itself - same split as docs/notes/executedelete-cannot-be-unit-tested-here.md
    public static Expression<Func<T, bool>> Matches<T>(MediaFilter filter) where T : IMediaImage
    {
        var (formatSuffix, formatAlt) = SuffixesFor(filter.Format);
        var (targetSuffix, targetAlt) = SuffixesFor(filter.TargetFormat);
        var targetWidth = filter.TargetMaxWidth;

        var minWidth = filter.MinWidth;
        var maxWidth = filter.MaxWidth;
        var minHeight = filter.MinHeight;
        var maxHeight = filter.MaxHeight;
        var minSize = filter.MinSizeBytes;
        var maxSize = filter.MaxSizeBytes;
        var createdFrom = ToUtc(filter.CreatedFrom);
        var createdTo = ToUtc(filter.CreatedTo);

        return m =>
            (formatSuffix == null
                || m.ImageUrl.ToLower().EndsWith(formatSuffix)
                || (formatAlt != null && m.ImageUrl.ToLower().EndsWith(formatAlt)))
            && (minWidth == null || m.Width >= minWidth)
            && (maxWidth == null || m.Width <= maxWidth)
            && (minHeight == null || m.Height >= minHeight)
            && (maxHeight == null || m.Height <= maxHeight)
            && (minSize == null || m.SizeBytes >= minSize)
            && (maxSize == null || m.SizeBytes <= maxSize)
            && (createdFrom == null || m.CreatedAt >= createdFrom)
            && (createdTo == null || m.CreatedAt < createdTo)
            && ((targetWidth == null && targetSuffix == null)
                || (targetWidth != null
                    && (m.Width <= 0 || m.Height <= 0 || m.Width > targetWidth || m.Height > targetWidth))
                || (targetSuffix != null
                    && !m.ImageUrl.ToLower().EndsWith(targetSuffix)
                    && (targetAlt == null || !m.ImageUrl.ToLower().EndsWith(targetAlt))));
    }

    // keep-comment: Npgsql refuses a DateTime whose Kind is Unspecified against timestamptz, and a date bound off the query string is always Unspecified - SQLite takes it either way, so without this every test is green and every filtered request 500s in production
    public static DateTime? ToUtc(DateTime? value) => value switch
    {
        null => null,
        { Kind: DateTimeKind.Utc } => value,
        { Kind: DateTimeKind.Local } => value.Value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(value.Value, DateTimeKind.Utc)
    };

    // keep-comment: a trail symbol stores no width/height/size, so its 0 sentinels would satisfy every "smaller than" bound; under any of these it is left out rather than answered for wrongly
    public static bool HasMetadataFilter(MediaFilter filter) =>
        !string.IsNullOrWhiteSpace(filter.Format)
        || !string.IsNullOrWhiteSpace(filter.TargetFormat)
        || filter.TargetMaxWidth.HasValue
        || filter.MinWidth.HasValue || filter.MaxWidth.HasValue
        || filter.MinHeight.HasValue || filter.MaxHeight.HasValue
        || filter.MinSizeBytes.HasValue || filter.MaxSizeBytes.HasValue;

    private static string? Trimmed(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    // keep-comment: jpeg needs both spellings - MediaItemResponse reports a ".jpg" file as "jpeg", so matching only ".jpeg" would make the format a caller reads back one it can never filter on
    private static (string? Suffix, string? Alternate) SuffixesFor(string? format)
    {
        var trimmed = Trimmed(format)?.ToLowerInvariant();

        return trimmed switch
        {
            null => (null, null),
            "jpeg" or "jpg" => (".jpeg", ".jpg"),
            _ => ($".{trimmed}", null)
        };
    }

    public async Task<RepositoryResult<MediaLibraryPage>> GetMediaPagedAsync(
        MediaLibraryQuery query, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var page = Math.Clamp(query.Page, 1, MediaLibraryQuery.MaxPage);
            var pageSize = query.PageSize is < 1 or > MediaLibraryQuery.MaxPageSize
                ? MediaLibraryQuery.DefaultPageSize
                : query.PageSize;

            var matched = new List<MediaItemProjection>();
            var reprocessableCount = 0;

            foreach (var source in Sources(context, query))
            {
                var rows = await source.Query.ToListAsync(ctoken);
                matched.AddRange(rows);

                if (source.Reprocessable)
                    reprocessableCount += rows.Count;
            }

            // keep-comment: long, so the arithmetic cannot wrap even if the clamp above is ever loosened - unwrapped, a negative Skip silently serves page 1 under the page number that was asked for
            var skip = (int)Math.Min((long)(page - 1) * pageSize, int.MaxValue);

            var items = Ordered(matched, query.Sort)
                .Skip(skip)
                .Take(pageSize)
                .ToList();

            return RepositoryResult<MediaLibraryPage>.Success(new MediaLibraryPage(
                items,
                page,
                (long)page * pageSize < matched.Count,
                matched.Count,
                reprocessableCount,
                matched.Sum(m => m.SizeBytes)));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MediaRepository: GetMediaPagedAsync -> Something went wrong when fetching media.");
            return RepositoryResult<MediaLibraryPage>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyCollection<MediaLookupProjection>>> GetMatchingAsync(
        MediaFilter filter, int limit, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var matching = new List<MediaLookupProjection>();

            // keep-comment: rowLimit is what bounds this read - the cap the caller applies afterwards is a batch-size cap, and without it a filter matching the whole library is materialised in full before being refused
            foreach (var source in Sources(context, filter, rowLimit: limit).Where(s => s.Reprocessable))
            {
                var rows = await source.Query.ToListAsync(ctoken);

                matching.AddRange(rows
                    .Select(m => new MediaLookupProjection(m.Identifier, m.OwnerType, m.ImageUrl)));
            }

            IReadOnlyCollection<MediaLookupProjection> capped = matching.Take(limit).ToList();

            return RepositoryResult<IReadOnlyCollection<MediaLookupProjection>>.Success(capped);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MediaRepository: GetMatchingAsync -> Something went wrong when expanding a media filter.");
            return RepositoryResult<IReadOnlyCollection<MediaLookupProjection>>.Error();
        }
    }

    private sealed record MediaSource(IQueryable<MediaItemProjection> Query, bool Reprocessable);

    // keep-comment: three separate queries merged in memory rather than one Concat - EF refuses a set operation after a client projection ("Unable to translate set operation after client projection has been applied")
    // keep-comment: rowLimit is applied to the ENTITY query, never to the projection - EF translates neither an OrderBy nor a Take through a constructor projection, and fails only against a real database
    private static IQueryable<T> Capped<T>(IQueryable<T> query, int? rowLimit) where T : BaseEntity =>
        rowLimit is int max ? query.OrderBy(entity => entity.Id).Take(max) : query;

    private static IEnumerable<MediaSource> Sources(
        StigViddDbContext context, MediaFilter filter, int? rowLimit = null)
    {
        var ownerType = MediaOwnerTypes.Canonical(filter.OwnerType);
        var ownerIdentifier = Trimmed(filter.OwnerIdentifier);
        var createdFrom = ToUtc(filter.CreatedFrom);
        var createdTo = ToUtc(filter.CreatedTo);

        // keep-comment: an owner type the validator would have rejected matches nothing rather than every source - widening an unrecognised filter is the one outcome an operator cannot see is wrong
        if (ownerType is null && !string.IsNullOrWhiteSpace(filter.OwnerType))
            yield break;

        if (ownerType is null or MediaOwnerTypes.Trail)
        {
            var trailImages = context.TrailImages.AsNoTracking().Where(Matches<TrailImage>(filter));

            if (ownerIdentifier != null)
                trailImages = trailImages.Where(ti => ti.Trail!.Identifier == ownerIdentifier);

            yield return new MediaSource(
                Capped(trailImages, rowLimit).Select(ti => new MediaItemProjection(
                    ti.Id, ti.Identifier, ti.ImageUrl, ti.AltText, ti.Caption, ti.Width, ti.Height, ti.SizeBytes,
                    ti.CreatedAt, MediaOwnerTypes.Trail, ti.Trail!.Identifier, ti.Trail.Name)),
                Reprocessable: true);
        }

        if (ownerType is null or MediaOwnerTypes.Facility)
        {
            var facilityImages = context.FacilityImages.AsNoTracking().Where(Matches<FacilityImage>(filter));

            if (ownerIdentifier != null)
                facilityImages = facilityImages.Where(fi => fi.Facility!.Identifier == ownerIdentifier);

            yield return new MediaSource(
                Capped(facilityImages, rowLimit).Select(fi => new MediaItemProjection(
                    fi.Id, fi.Identifier, fi.ImageUrl, fi.AltText, fi.Caption, fi.Width, fi.Height, fi.SizeBytes,
                    fi.CreatedAt, MediaOwnerTypes.Facility, fi.Facility!.Identifier, fi.Facility.Name)),
                Reprocessable: true);
        }

        if (ownerType is null or MediaOwnerTypes.TrailSymbol && !HasMetadataFilter(filter))
        {
            var symbols = context.Trails.AsNoTracking().Where(t => t.TrailSymbolImage != "");

            if (ownerIdentifier != null)
                symbols = symbols.Where(t => t.Identifier == ownerIdentifier);

            if (createdFrom != null)
                symbols = symbols.Where(t => t.CreatedAt >= createdFrom);

            if (createdTo != null)
                symbols = symbols.Where(t => t.CreatedAt < createdTo);

            yield return new MediaSource(
                Capped(symbols, rowLimit).Select(t => new MediaItemProjection(
                    t.Id, t.Identifier, t.TrailSymbolImage, null, null, 0, 0, 0,
                    t.CreatedAt, MediaOwnerTypes.TrailSymbol, t.Identifier, t.Name)),
                Reprocessable: false);
        }
    }

    // keep-comment: ordering and paging happen here rather than in SQL because EF cannot order by, or aggregate over, a member of a constructor projection - only Where translates. The bound is the number of rows matching the filter, which is still strictly less than the whole library this endpoint used to return on every call.
    private static IEnumerable<MediaItemProjection> Ordered(List<MediaItemProjection> matched, string? sort) =>
        MediaSorts.Parse(sort) switch
        {
            MediaSort.Oldest => matched.OrderBy(m => m.CreatedAt).ThenBy(m => m.OwnerType, StringComparer.Ordinal).ThenBy(m => m.SourceId),
            MediaSort.Largest => matched.OrderByDescending(m => m.SizeBytes).ThenBy(m => m.OwnerType, StringComparer.Ordinal).ThenBy(m => m.SourceId),
            MediaSort.Widest => matched.OrderByDescending(m => m.Width).ThenBy(m => m.OwnerType, StringComparer.Ordinal).ThenBy(m => m.SourceId),
            _ => matched.OrderByDescending(m => m.CreatedAt).ThenBy(m => m.OwnerType, StringComparer.Ordinal).ThenBy(m => m.SourceId)
        };

    public async Task<RepositoryResult<IReadOnlyCollection<MediaLookupProjection>>> GetByIdentifiersAsync(
        IReadOnlyCollection<string> identifiers, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var trailImages = await context.TrailImages
                .AsNoTracking()
                .Where(ti => identifiers.Contains(ti.Identifier))
                .Select(ti => new MediaLookupProjection(ti.Identifier, "Trail", ti.ImageUrl))
                .ToListAsync(ctoken);

            var facilityImages = await context.FacilityImages
                .AsNoTracking()
                .Where(fi => identifiers.Contains(fi.Identifier))
                .Select(fi => new MediaLookupProjection(fi.Identifier, "Facility", fi.ImageUrl))
                .ToListAsync(ctoken);

            var all = trailImages.Concat(facilityImages).ToList();

            return RepositoryResult<IReadOnlyCollection<MediaLookupProjection>>.Success(all);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MediaRepository: GetByIdentifiersAsync -> Something went wrong when looking up media by identifier.");
            return RepositoryResult<IReadOnlyCollection<MediaLookupProjection>>.Error();
        }
    }

    public async Task<RepositoryResult> UpdateImageMetadataAsync(string imageIdentifier, string? altText, string? caption, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var trailImage = await context.TrailImages
                .FirstOrDefaultAsync(ti => ti.Identifier == imageIdentifier, ctoken);

            if (trailImage is not null)
            {
                trailImage.AltText = altText;
                trailImage.Caption = caption;
                trailImage.LastUpdatedAt = DateTime.UtcNow;
                await context.SaveChangesAsync(ctoken);
                return RepositoryResult.Success();
            }

            var facilityImage = await context.FacilityImages
                .FirstOrDefaultAsync(fi => fi.Identifier == imageIdentifier, ctoken);

            if (facilityImage is not null)
            {
                facilityImage.AltText = altText;
                facilityImage.Caption = caption;
                facilityImage.LastUpdatedAt = DateTime.UtcNow;
                await context.SaveChangesAsync(ctoken);
                return RepositoryResult.Success();
            }

            return RepositoryResult.NotFound();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MediaRepository: UpdateImageMetadataAsync -> Something went wrong updating image {ImageIdentifier}.", imageIdentifier);
            return RepositoryResult.Error();
        }
    }
}
