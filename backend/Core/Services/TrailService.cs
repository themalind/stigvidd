using Core.Factories;
using Core.Interfaces;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using WebDataContracts.ResponseModels.Trail;

namespace Core.Services;

public class TrailService : ITrailService
{
    private readonly IDbContextFactory<StigViddDbContext> _context;
    private readonly ILogger<TrailService> _logger;
    private readonly TrailResponseFactory _trailResponseFactory;

    public TrailService(IDbContextFactory<StigViddDbContext> context, ILogger<TrailService> logger, TrailResponseFactory factory)
    {
        _context = context;
        _logger = logger;
        _trailResponseFactory = factory;
    }

    public async Task<Result<TrailResponse?>> GetTrailByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var trail = await context.Trails
              .AsNoTracking()
              .Where(trail => trail.IsVerified == true)
              .Include(t => t.TrailImages)
              .Include(t => t.TrailLinks)
              .Include(t => t.VisitorInformation)
              .FirstOrDefaultAsync(t => t.Identifier == identifier, ctoken);

        if (trail == null)
        {
            _logger.LogInformation(
                "TrailService -> GetTrailByIdentifierAsync: Trail with identifier {Identifier} not found.", identifier);

            return Result.Fail<TrailResponse?>(new Message(404, $"Trail with identifier { identifier } not found."));
        }

        var trailResponse = _trailResponseFactory.Create(trail);

        return Result.Ok<TrailResponse?>(trailResponse);
    }

    public async Task<Result<IReadOnlyCollection<TrailOverviewResponse?>>> GetPopularTrailOverviewsAsync(
        double? userLatitude, double? userLongitude, CancellationToken ctoken)
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

            if (hasUserLocation && trail.StartLatitude.HasValue && trail.StartLongitude.HasValue)
            {
                var distanceKm = HaversineDistanceKm(
                    userLatitude!.Value, userLongitude!.Value,
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

        // Fetch the first image for each selected trail
        var trailIds = scoredTrails.Select(x => x.trail.Id).ToList();

        var trailImages = await context.Trails
            .AsNoTracking()
            .Where(t => trailIds.Contains(t.Id))
            .Select(t => new
            {
                t.Id,
                Image = t.TrailImages!
                    .Select(img => TrailImageResponse.Create(img.Identifier, img.ImageUrl))
                    .FirstOrDefault()
            })
            .ToDictionaryAsync(x => x.Id, x => x.Image, ctoken);

        var result = scoredTrails
            .Select(x => TrailOverviewResponse.Create(
                x.trail.Identifier,
                x.trail.Name,
                x.trail.TrailLength,
                x.trail.AverageRating,
                trailImages.TryGetValue(x.trail.Id, out var img) && img != null
                    ? new[] { img }
                    : Array.Empty<TrailImageResponse>()
            ))
            .ToList();

        return Result.Ok<IReadOnlyCollection<TrailOverviewResponse?>>(result!);
    }

    private static double HaversineDistanceKm(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 6371.0; // Earth radius in km
        var dLat = DegreesToRadians(lat2 - lat1);
        var dLon = DegreesToRadians(lon2 - lon1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(DegreesToRadians(lat1)) * Math.Cos(DegreesToRadians(lat2)) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return R * c;
    }

    private static double DegreesToRadians(double degrees) => degrees * Math.PI / 180.0;

    public async Task<Result<IReadOnlyCollection<TrailShortInfoResponse>>> GetAllTrailsWithBasicInfoAsync(CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        // Raw SQL is used here to extract only the first coordinate from the JSON array
        // using JSON_VALUE directly in SQL Server. This avoids fetching the entire Coordinates blob
        // This to determine distance to user when filtering on distance.
        var trailsWithShortInfo = await context.Database
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

        return Result.Ok<IReadOnlyCollection<TrailShortInfoResponse>>(trailsWithShortInfo);
    }
}