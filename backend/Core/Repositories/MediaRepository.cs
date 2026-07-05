using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

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

    public async Task<RepositoryResult<IReadOnlyCollection<MediaItemProjection>>> GetAllMediaAsync(CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var trailImages = await context.TrailImages
                .AsNoTracking()
                .Select(ti => new MediaItemProjection(
                    ti.Identifier, ti.ImageUrl, ti.AltText, ti.Caption, ti.Width, ti.Height, ti.SizeBytes,
                    "Trail", ti.Trail!.Identifier, ti.Trail.Name))
                .ToListAsync(ctoken);

            var facilityImages = await context.FacilityImages
                .AsNoTracking()
                .Select(fi => new MediaItemProjection(
                    fi.Identifier, fi.ImageUrl, fi.AltText, fi.Caption, fi.Width, fi.Height, fi.SizeBytes,
                    "Facility", fi.Facility!.Identifier, fi.Facility.Name))
                .ToListAsync(ctoken);

            var symbols = await context.Trails
                .AsNoTracking()
                .Where(t => t.TrailSymbolImage != "")
                .Select(t => new MediaItemProjection(
                    t.Identifier, t.TrailSymbolImage, null, null, 0, 0, 0,
                    "TrailSymbol", t.Identifier, t.Name))
                .ToListAsync(ctoken);

            var all = trailImages.Concat(facilityImages).Concat(symbols).ToList();

            return RepositoryResult<IReadOnlyCollection<MediaItemProjection>>.Success(all);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MediaRepository: GetAllMediaAsync -> Something went wrong when fetching media.");
            return RepositoryResult<IReadOnlyCollection<MediaItemProjection>>.Error();
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
