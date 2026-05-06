using System.Linq.Expressions;
using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using WebDataContracts.ResponseModels.Trail;

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

    public async Task<RepositoryResult<IReadOnlyCollection<TrailShortInfoResponse>>> GetAllTrailsWithBasicInfoAsync(CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var trails = await context.Database
                .SqlQueryRaw<TrailShortInfoResponse>(
                   """
                        SELECT
                            Identifier,
                            Name,
                            TrailLength,
                            Accessibility,
                            Classification,
                            City,
                            CAST(JSON_VALUE(Coordinates, '$[0].latitude') AS decimal(18,10)) AS StartLatitude,
                            CAST(JSON_VALUE(Coordinates, '$[0].longitude') AS decimal(18,10)) AS StartLongitude
                        FROM Trails
                        WHERE IsVerified = 1
                        """)
                .AsNoTracking()
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<TrailShortInfoResponse>>.Success(trails);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailRepository: GetAllTrailsWithBasicInfoAsync -> Something went wrong when fetching trails.");
            return RepositoryResult<IReadOnlyCollection<TrailShortInfoResponse>>.Error();
        }
    }

    public async Task<RepositoryResult<string>> GetCoordinatesByTrailIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var coordinates = await context.Trails
                .AsNoTracking()
                .Where(t => t.Identifier == identifier && t.IsVerified == true)
                .Select(t => t.Coordinates)
                .FirstOrDefaultAsync(ctoken);

            return coordinates is null
                ? RepositoryResult<string>.NotFound()
                : RepositoryResult<string>.Success(coordinates);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailRepository: GetCoordinatesByTrailIdentifierAsync -> Something went wrong when fetching coordinates for trail with identifier {identifier}.", identifier);
            return RepositoryResult<string>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyCollection<TrailOverviewResponse>>> GetPopularTrailOverviewsAsync(double? userLatitude, double? userLongitude, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var hasUserLocation = userLatitude.HasValue && userLongitude.HasValue;

            // Raw SQL extracts only the first coordinate via JSON_VALUE and computes
            // average rating in SQL, avoiding fetching the entire Coordinates blob.
            var trailData = await context.Database
                .SqlQueryRaw<PopularTrailQueryResult>(
                    """
                        SELECT
                            t.Id,
                            t.Identifier,
                            t.Name,
                            t.TrailLength,
                            ISNULL(AVG(r.Rating), 0) AS AverageRating,
                            CAST(JSON_VALUE(t.Coordinates, '$[0].latitude') AS float) AS StartLatitude,
                            CAST(JSON_VALUE(t.Coordinates, '$[0].longitude') AS float) AS StartLongitude
                        FROM Trails t
                        LEFT JOIN Reviews r ON r.TrailId = t.Id
                        WHERE t.IsVerified = 1
                        GROUP BY t.Id, t.Identifier, t.Name, t.TrailLength, t.Coordinates
                        """)
                .AsNoTracking()
                .ToListAsync(ctoken);

            var scoredTrails = trailData.Select(trail =>
            {
                double score = (double)trail.AverageRating;

                // Senior advice: This might be better to do in SQL, since it can be done in the same query
                // and avoid fetching all trails when user location is provided.
                // You could create a SQL function or stored procedure to calculate the Haversine distance
                // and use it in the SELECT clause to compute a proximity score directly in the database.
                if (hasUserLocation && trail.StartLatitude.HasValue && trail.StartLongitude.HasValue)
                {
                    var distanceKm = HaversineDistanceKm(
                        userLatitude.GetValueOrDefault(), userLongitude.GetValueOrDefault(),
                        trail.StartLatitude.Value, trail.StartLongitude.Value);

                    // Proximity boost: closer trails get a higher bonus (max ~5 points at 0 km, decaying with distance)
                    double proximityBonus = 5.0 / (1.0 + distanceKm / 10.0);
                    score += proximityBonus;
                }

                return new { trail, score };
            })
            .OrderByDescending(x => x.score)
            .Take(10)
            .ToList();

            var trailIds = scoredTrails.Select(x => x.trail.Id).ToList();

            var trailImages = await context.Trails
                .AsNoTracking()
                .Where(t => trailIds.Contains(t.Id))
                .Select(t => new
                {
                    TrailId = t.Id,
                    FirstTrailImage = t.TrailImages!
                        .Select(img => TrailImageResponse.Create(img.Identifier, img.ImageUrl))
                        .FirstOrDefault()
                })
                .ToDictionaryAsync(x => x.TrailId, x => x.FirstTrailImage, ctoken);

            IReadOnlyCollection<TrailOverviewResponse> result = scoredTrails
                .Select(x => TrailOverviewResponse.Create(
                    x.trail.Identifier,
                    x.trail.Name,
                    x.trail.TrailLength,
                    x.trail.AverageRating,
                    trailImages.TryGetValue(x.trail.Id, out var img) && img != null
                        ? new[] { img }
                        : Array.Empty<TrailImageResponse>()))
                .ToList();

            return RepositoryResult<IReadOnlyCollection<TrailOverviewResponse>>.Success(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailRepository: GetPopularTrailOverviewsAsync -> Something went wrong when fetching popular trail overviews.");
            return RepositoryResult<IReadOnlyCollection<TrailOverviewResponse>>.Error();
        }
    }

    private static double HaversineDistanceKm(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 6371.0;
        var dLat = DegreesToRadians(lat2 - lat1);
        var dLon = DegreesToRadians(lon2 - lon1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(DegreesToRadians(lat1)) * Math.Cos(DegreesToRadians(lat2)) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return R * c;
    }

    private static double DegreesToRadians(double degrees) => degrees * Math.PI / 180.0;

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

    public async Task<RepositoryResult<IReadOnlyCollection<TrailMarkerResponse>>> GetAllTrailMarkersAsync(CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var markers = await context.Database
                .SqlQueryRaw<TrailMarkerResponse>(
                   """
                        SELECT
                            t.Identifier,
                            t.Name,
                            CAST(JSON_VALUE(t.Coordinates, '$[0].latitude') AS decimal(18,10)) AS StartLatitude,
                            CAST(JSON_VALUE(t.Coordinates, '$[0].longitude') AS decimal(18,10)) AS StartLongitude
                        FROM Trails t
                        WHERE t.IsVerified = 1
                        GROUP BY t.Identifier, t.Name, t.Coordinates
                        """)
                .AsNoTracking()
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<TrailMarkerResponse>>.Success(markers);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailRepository: GetAllTrailMarkersAsync -> Something went wrong when fetching trail markers.");
            return RepositoryResult<IReadOnlyCollection<TrailMarkerResponse>>.Error();
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
}
