using Core.Factories;
using Core.Interfaces;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using WebDataContracts.RequestModels.Trail;
using WebDataContracts.ResponseModels.Trail;

namespace Core.Services;

public class TrailService : ITrailService
{
    private readonly string _presentableBaseUrl;
    private readonly IDbContextFactory<StigViddDbContext> _context;
    private readonly IWebDavService _webDavService;
    private readonly ILogger<TrailService> _logger;
    private readonly TrailResponseFactory _trailResponseFactory;

    public TrailService(IDbContextFactory<StigViddDbContext> context, IWebDavService webDavService, ILogger<TrailService> logger, TrailResponseFactory factory, IConfiguration configuration)
    {
        _presentableBaseUrl = configuration["PresentableBaseUrl"] ?? throw new InvalidOperationException("PresentableBaseUrl configuration is missing");
        _context = context;
        _webDavService = webDavService;
        _logger = logger;
        _trailResponseFactory = factory;
    }

    public async Task<Result<int>> GetTrailIdByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var trailId = await context.Trails
            .Where(t => t.Identifier == identifier)
            .Select(t => t.Id)
            .FirstOrDefaultAsync();

        if (trailId == 0)
        {
            _logger.LogWarning("Trail with identifier {identifier} not found.", identifier);
            return Result.Fail<int>(new Message(404, $"Trail with identifier {identifier} not found."));
        }

        return Result.Ok(trailId);
    }

    public async Task<Result<TrailResponse?>> GetTrailByIdentifierWithoutCoordinatesAsync(string identifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        try
        {
            var trail = await context.Trails
                  .AsNoTracking()
                  .Where(trail => trail.IsVerified == true && trail.Identifier == identifier)
                  .Select(trail => TrailResponse.Create(
                       trail.Identifier,
                       trail.Name,
                       trail.TrailLength,
                       trail.Classification,
                       trail.Accessibility,
                       trail.AccessibilityInfo,
                       trail.TrailSymbol,
                       trail.TrailSymbolImage,
                       trail.Description,
                       trail.FullDescription,
                       trail.Tags,
                       trail.CreatedBy!,
                       trail.IsVerified,
                       trail.City,

                       trail.TrailImages!.Select(
                           image => TrailImageResponse.Create(
                           image.Identifier,
                           image.ImageUrl)).ToList(),

                       trail.TrailLinks!.Select(
                           link => TrailLinkResponse.Create(
                           link.Identifier,
                           link.Link,
                           link.Title)).ToList(),

                       trail.VisitorInformation != null ? VisitorInformationResponse.Create(
                           trail.VisitorInformation.Identifier,
                           trail.VisitorInformation.GettingThere,
                           trail.VisitorInformation.PublicTransport,
                           trail.VisitorInformation.Parking,
                           trail.VisitorInformation.Illumination,
                           trail.VisitorInformation.IlluminationText,
                           trail.VisitorInformation.MaintainedBy,
                           trail.VisitorInformation.WinterMaintenance) : null

                       ))
                  .FirstOrDefaultAsync(ctoken);

            if (trail == null)
            {
                _logger.LogInformation(
                    "TrailService -> GetTrailByIdentifierWithoutCoordinatesAsync: Trail with identifier {Identifier} not found.", identifier);

                return Result.Fail<TrailResponse?>(new Message(404, $"Trail with identifier {identifier} not found."));
            }

            return Result.Ok<TrailResponse?>(trail);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching trail with identifier: {Identifier}", identifier);

            return Result.Fail<TrailResponse?>(new Message(500, "An error occurred while fetching the trail."));
        }
    }

    public async Task<Result<CoordinatesResponse?>> GetCoordinatesByTrailIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);
        try
        {
            var coordinates = await context.Trails
                .AsNoTracking()
                .Where(t => t.Identifier == identifier && t.IsVerified == true)
                .Select(t => t.Coordinates)
                .FirstOrDefaultAsync(ctoken);

            if (coordinates == null)
            {
                _logger.LogInformation(
                    "TrailService -> GetCoordinatesByTrailIdentifierAsync: Coordinates with Trail identifier: {Identifier} not found.", identifier);

                return Result.Fail<CoordinatesResponse?>(new Message(404, $"Coordinates with Trail identifier: {identifier} not found."));
            }

            return Result.Ok<CoordinatesResponse?>(CoordinatesResponse.Create(coordinates));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching coordinates for Trail with identifier: {Identifier}", identifier);

            return Result.Fail<CoordinatesResponse?>(new Message(500, "An error occurred while fetching coordinates."));
        }
    }

    public async Task<Result<IReadOnlyCollection<TrailOverviewResponse?>>> GetPopularTrailOverviewsAsync(
        double? userLatitude, double? userLongitude, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var hasUserLocation = userLatitude.HasValue && userLongitude.HasValue;

        try
        {
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
                .Where(trail => trailIds.Contains(trail.Id))
                .Select(trail => new
                {
                    TrailId = trail.Id,
                    FirstTrailImage = trail.TrailImages!
                        .Select(img => TrailImageResponse.Create(img.Identifier, img.ImageUrl))
                        .FirstOrDefault()
                })
                .ToDictionaryAsync(x => x.TrailId, x => x.FirstTrailImage, ctoken);

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

            return Result.Ok<IReadOnlyCollection<TrailOverviewResponse?>>(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching popular trail overviews.");

            return Result.Fail<IReadOnlyCollection<TrailOverviewResponse?>>(new Message(500, "An error occurred while fetching popular trails."));
        }
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

    public async Task<Result<TrailResponse?>> AddTrailAsync(
        CreateTrailRequest request,
        IFormFile? trailSymbolImageUrl,
        IFormFileCollection? trailImageUrls,
        string userIdentifier,
        CancellationToken ctoken
    )
    {
        using var context = await _context.CreateDbContextAsync(ctoken);
        var trailSymbolUrl = string.Empty;
        var uploadedImageUrls = new List<string>();

        try
        {
            if (trailSymbolImageUrl != null)
            {
                var result = await _webDavService.UploadFileAsync(trailSymbolImageUrl.OpenReadStream(), "symbols");

                if (result.IsFailure)
                {
                    return Result.Fail<TrailResponse?>(new Message(500, "Something went wrong, could not create trail. Try again later."));
                }

                if (result.Value != null)
                {
                    trailSymbolUrl = result.Value;
                    uploadedImageUrls.Add(result.Value);
                }
            }

            if (trailImageUrls != null)
            {
                foreach (var image in trailImageUrls)
                {
                    var result = await _webDavService.UploadFileAsync(image.OpenReadStream(), "trails");

                    if (result.IsFailure)
                    {
                        return Result.Fail<TrailResponse?>(new Message(500, "Something went wrong, could not create Trail. Try again Later."));
                    }

                    if (result.Value != null)
                    {
                        uploadedImageUrls.Add(result.Value);
                    }
                }
            }

            var trail = new Trail
            {
                Name = request.Name,
                TrailLength = request.TrailLength,
                Classification = request.Classification ?? 0,
                Accessibility = request.Accessibility ?? false,
                AccessibilityInfo = request.AccessibilityInfo ?? string.Empty,
                TrailSymbol = request.TrailSymbol ?? string.Empty,
                TrailSymbolImage = trailSymbolUrl,
                Description = request.Description ?? string.Empty,
                FullDescription = request.FullDescription ?? string.Empty,
                Coordinates = request.Coordinates,
                Tags = request.Tags ?? string.Empty,
                CreatedBy = userIdentifier,
                IsVerified = false,
                City = request.City ?? string.Empty,
            };

            if (uploadedImageUrls.Count != 0)
            {
                foreach (var image in uploadedImageUrls)
                {
                    var trailImage = new TrailImage
                    {
                        ImageUrl = image,
                        Trail = trail
                    };

                    context.TrailImages.Add(trailImage);
                }
            }

            context.Trails.Add(trail);
            await context.SaveChangesAsync(ctoken);

            _logger.LogInformation("Trail added successfully for user: {userIdentifier}", userIdentifier);

            return Result.Ok(_trailResponseFactory?.Create(trail));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding trail for user: {userIdentifier}", userIdentifier);

            if (uploadedImageUrls.Count != 0)
            {
                await CleanupUploadedImagesAsync(uploadedImageUrls);
            }

            return Result.Fail<TrailResponse?>(new Message(500, "An error occurred while adding the trail."));
        }
    }

    private async Task CleanupUploadedImagesAsync(List<string> urls)
    {
        foreach (var url in urls)
        {
            try
            {
                await _webDavService.DeleteFileAsync(url);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to cleanup uploaded image: {Url}", url);
            }
        }
    }

    public async Task<Result<IReadOnlyCollection<TrailShortInfoResponse>>> GetAllTrailsWithBasicInfoAsync(CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        // Raw SQL is used here to extract only the first coordinate from the JSON array
        // using JSON_VALUE directly in SQL Server. This avoids fetching the entire Coordinates blob
        // This to determine distance to user when filtering on distance.
        try
        {
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
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching trails with basic info.");

            return Result.Fail<IReadOnlyCollection<TrailShortInfoResponse>>(new Message(500, "An error occurred while fetching trails."));
        }
    }
}