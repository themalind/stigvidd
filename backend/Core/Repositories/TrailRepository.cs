using Core.Common;
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

    // The proximity term's ceiling, in the same units as the average rating it is added to,
    // so a trail on the doorstep can outrank a better-reviewed one further off.
    private const double ProximityBoostPoints = 5.0;

    // Distance at which that boost halves. 5 km is a walk-today radius, and small enough that
    // trails two municipalities away do not all score alike — which is what the previous
    // 10-DEGREE scale (about 1 100 km) did, making the term a constant and the ranking
    // rating-only in everything but appearance.
    private const double ProximityHalfBoostMetres = 5_000.0;

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

            // A trail with no path has no start point to rank by, so it is ineligible either
            // way — consistent with the markers and basic-info queries.
            var eligibleTrails = context.Trails.AsNoTracking()
                .Where(t => t.IsVerified && t.GeoPath != null);

            // Score = average rating, boosted by proximity when the user's location is known.
            // Ordering/scoring is a data concern and stays here; the projection shape comes
            // from the caller's selector so the repository never builds a response model.
            //
            // The two cases are separate queries on purpose. Folding them into one with a
            // `hasLocation ? ... : 0.0` term reads tidier but ships the whole geometry
            // expression to the server on the no-location path as well — EF parameterises the
            // captured bool rather than folding it, so ST_StartPoint/ST_X/ST_Y/sqrt would run
            // over every candidate row to be multiplied by nothing.
            IQueryable<Trail> rankedTrails;

            if (userLatitude.HasValue && userLongitude.HasValue)
            {
                // Distance has to come out in METRES, and ST_Distance on a geometry column gives
                // degrees — which is not a unit you can pick a threshold in, because a degree of
                // longitude at 57.7 N is barely half a degree of latitude. So scale each axis by
                // its own metres-per-degree at the user, which is exactly what LocalMetricProjection
                // already works out. Equirectangular, and well under a percent over a region: this
                // is a relevance weight, not a measurement.
                //
                // Deliberately NOT ST_DistanceSphere or a ::geography cast. Those are Npgsql-only,
                // and this query has to translate on three providers — Npgsql in production,
                // SpatiaLite in the integration suite, and in-process NTS under EF InMemory in the
                // unit tests. ST_X/ST_Y/ST_StartPoint plus arithmetic translate on all three.
                var originLongitude = userLongitude.Value;
                var originLatitude = userLatitude.Value;
                var projection = LocalMetricProjection.CentredOn(new Coordinate(originLongitude, originLatitude));
                var metresPerDegreeLongitude = projection.MetresPerDegreeLongitude;
                var metresPerDegreeLatitude = projection.MetresPerDegreeLatitude;

                rankedTrails =
                    from t in eligibleTrails
                    let eastingMetres = (t.GeoPath!.StartPoint.X - originLongitude) * metresPerDegreeLongitude
                    let northingMetres = (t.GeoPath!.StartPoint.Y - originLatitude) * metresPerDegreeLatitude
                    let metresAway = Math.Sqrt((eastingMetres * eastingMetres) + (northingMetres * northingMetres))
                    let score = (double)(t.Reviews!.Any() ? t.Reviews!.Average(r => r.Rating) : 0m)
                        + (ProximityBoostPoints / (1.0 + (metresAway / ProximityHalfBoostMetres)))
                    orderby score descending
                    select t;
            }
            else
            {
                rankedTrails =
                    from t in eligibleTrails
                    let rating = t.Reviews!.Any() ? t.Reviews!.Average(r => r.Rating) : 0m
                    orderby rating descending
                    select t;
            }

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
