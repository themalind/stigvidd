using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Geometries;
using System.Linq.Expressions;

namespace Core.Repositories;

public class TrailRepository : ITrailRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _context;
    private readonly ILogger<TrailRepository> _logger;

    public TrailRepository(IDbContextFactory<StigViddDbContext> context, ILogger<TrailRepository> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<RepositoryResult<IReadOnlyCollection<T>>> GetAllTrailsWithBasicInfoAsync<T>(
        Expression<Func<Trail, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var trails = await context.Trails.AsNoTracking()
                .Where(t => t.IsVerified && t.GeoPath != null)
                .Select(selector)
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<T>>.Success(trails);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailRepository: GetAllTrailsWithBasicInfoAsync -> Something went wrong when fetching trails.");
            return RepositoryResult<IReadOnlyCollection<T>>.Error();
        }
    }

    public async Task<RepositoryResult<string>> GetCoordinatesByTrailIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var match = await context.Trails
                .AsNoTracking()
                .Where(t => t.Identifier == identifier && t.IsVerified == true)
                .Select(t => new { t.GeoPath })
                .FirstOrDefaultAsync(ctoken);

            return match is null
                ? RepositoryResult<string>.NotFound()
                : RepositoryResult<string>.Success(GeoPathSerializer.ToCoordinateJson(match.GeoPath));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailRepository: GetCoordinatesByTrailIdentifierAsync -> Something went wrong when fetching coordinates for trail with identifier {identifier}.", identifier);
            return RepositoryResult<string>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyCollection<T>>> GetPopularTrailOverviewsAsync<T>(
        double? userLatitude, double? userLongitude, Expression<Func<Trail, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var userLocation = userLatitude.HasValue && userLongitude.HasValue
                ? Geometry.DefaultFactory.WithSRID(4326).CreatePoint(new Coordinate(userLongitude.Value, userLatitude.Value))
                : null;

            // Score = average rating, boosted by proximity when the user's location is known.
            // Ordering/scoring is a data concern and stays here; the projection shape comes
            // from the caller's selector so the repository never builds a response model.
            var rankedTrails =
                from t in context.Trails.AsNoTracking()
                where t.IsVerified && t.GeoPath != null
                let score = (double)(t.Reviews!.Any() ? t.Reviews!.Average(r => r.Rating) : 0m)
                    + (userLocation != null ? (5.0 / (1.0 + t.GeoPath!.StartPoint.Distance(userLocation) / 10.0)) : 0.0)
                orderby score descending
                select t;

            var result = await rankedTrails.Take(10).Select(selector).ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<T>>.Success(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailRepository: GetPopularTrailOverviewsAsync -> Something went wrong when fetching popular trail overviews.");
            return RepositoryResult<IReadOnlyCollection<T>>.Error();
        }
    }

    public async Task<RepositoryResult<T>> GetTrailByIdentifierAsync<T>(string identifier, Expression<Func<Trail, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var result = await context.Trails
                .AsNoTracking()
                .Where(t => t.Identifier == identifier && t.IsVerified == true)
                .Select(selector)
                .FirstOrDefaultAsync(ctoken);

            return result is null
                ? RepositoryResult<T>.NotFound()
                : RepositoryResult<T>.Success(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailRepository: GetTrailByIdentifierAsync -> Something went wrong when fetching trail with identifier {identifier}.", identifier);
            return RepositoryResult<T>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyCollection<T>>> GetTrailsByIdentifiersAsync<T>(
        IReadOnlyCollection<string> identifiers, Expression<Func<Trail, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var results = await context.Trails
                .AsNoTracking()
                .Where(t => t.IsVerified && identifiers.Contains(t.Identifier))
                .Select(selector)
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<T>>.Success(results);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailRepository: GetTrailsByIdentifiersAsync -> Something went wrong when fetching trails by identifiers.");
            return RepositoryResult<IReadOnlyCollection<T>>.Error();
        }
    }

    public async Task<RepositoryResult<int>> GetTrailIdByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var trailId = await context.Trails
                .Where(t => t.Identifier == identifier)
                .Select(t => (int?)t.Id)
                .FirstOrDefaultAsync(ctoken);

            return trailId is null
                ? RepositoryResult<int>.NotFound()
                : RepositoryResult<int>.Success(trailId.Value);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailRepository: GetTrailIdByIdentifierAsync -> Something went wrong when fetching trail ID with identifier {identifier}.", identifier);
            return RepositoryResult<int>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyCollection<T>>> GetAllTrailMarkersAsync<T>(
        Expression<Func<Trail, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var markers = await context.Trails.AsNoTracking()
                .Where(t => t.IsVerified && t.GeoPath != null)
                .Select(selector)
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<T>>.Success(markers);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailRepository: GetAllTrailMarkersAsync -> Something went wrong when fetching trail markers.");
            return RepositoryResult<IReadOnlyCollection<T>>.Error();
        }
    }

    public async Task<RepositoryResult<Trail>> AddTrailAsync(Trail trail, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            context.Trails.Add(trail);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<Trail>.Success(trail);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailRepository: AddTrailAsync -> Something went wrong when adding trail.");
            return RepositoryResult<Trail>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyCollection<TrailImage>>> AddTrailImagesAsync(int trailId, IReadOnlyCollection<TrailImage> images, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var trailExists = await context.Trails.AnyAsync(t => t.Id == trailId, ctoken);

            if (!trailExists)
                return RepositoryResult<IReadOnlyCollection<TrailImage>>.NotFound();

            foreach (var image in images)
                image.TrailId = trailId;

            context.TrailImages.AddRange(images);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<TrailImage>>.Success(images);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailRepository: AddTrailImagesAsync -> Something went wrong when adding images to trail with ID {TrailId}.", trailId);
            return RepositoryResult<IReadOnlyCollection<TrailImage>>.Error();
        }
    }

    public async Task<RepositoryResult> UpdateTrailSymbolAsync(string trailIdentifier, string symbolPath, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var trail = await context.Trails
                .FirstOrDefaultAsync(t => t.Identifier == trailIdentifier, ctoken);

            if (trail is null)
                return RepositoryResult.NotFound();

            trail.TrailSymbolImage = symbolPath;
            trail.LastUpdatedAt = DateTime.UtcNow;

            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailRepository: UpdateTrailSymbolAsync -> Something went wrong updating symbol for trail {TrailIdentifier}.", trailIdentifier);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult> DeleteTrailImageAsync(string imageIdentifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var image = await context.TrailImages
                .Where(img => img.Identifier == imageIdentifier)
                .FirstOrDefaultAsync(ctoken);

            if (image is null)
                return RepositoryResult.NotFound();

            context.TrailImages.Remove(image);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailRepository: DeleteTrailImageAsync -> Something went wrong when deleting image with identifier {ImageIdentifier}.", imageIdentifier);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult<Trail>> UpdateTrailAsync(Trail trail, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var existing = await context.Trails
                .Include(t => t.VisitorInformation)
                .Where(t => t.Identifier == trail.Identifier)
                .FirstOrDefaultAsync(ctoken);

            if (existing is null)
                return RepositoryResult<Trail>.NotFound();

            existing.Name = trail.Name;
            existing.TrailLength = trail.TrailLength;
            existing.Classification = trail.Classification;
            existing.Accessibility = trail.Accessibility;
            existing.AccessibilityInfo = trail.AccessibilityInfo;
            existing.TrailSymbol = trail.TrailSymbol;
            existing.Description = trail.Description;
            existing.FullDescription = trail.FullDescription;
            existing.Tags = trail.Tags;
            existing.City = trail.City;
            existing.LastUpdatedAt = DateTime.UtcNow;

            if (trail.VisitorInformation != null)
            {
                if (existing.VisitorInformation != null)
                {
                    existing.VisitorInformation.GettingThere = trail.VisitorInformation.GettingThere;
                    existing.VisitorInformation.PublicTransport = trail.VisitorInformation.PublicTransport;
                    existing.VisitorInformation.Parking = trail.VisitorInformation.Parking;
                    existing.VisitorInformation.Illumination = trail.VisitorInformation.Illumination;
                    existing.VisitorInformation.IlluminationText = trail.VisitorInformation.IlluminationText;
                    existing.VisitorInformation.MaintainedBy = trail.VisitorInformation.MaintainedBy;
                    existing.VisitorInformation.WinterMaintenance = trail.VisitorInformation.WinterMaintenance;
                    existing.VisitorInformation.LastUpdatedAt = DateTime.UtcNow;
                }
                else
                {
                    existing.VisitorInformation = trail.VisitorInformation;
                }
            }

            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<Trail>.Success(existing);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailRepository: UpdateTrailAsync -> Something went wrong when updating trail with identifier {Identifier}.", trail.Identifier);
            return RepositoryResult<Trail>.Error();
        }
    }
}
