using Core.Factories;
using Core.Interfaces;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using WebDataContracts.RequestModels.Trail;
using WebDataContracts.ResponseModels.Trail;

namespace Core.Services;

public class TrailService : ITrailService
{
    private readonly IDbContextFactory<StigViddDbContext> _context;
    private readonly IWebDavService _webDavService;
    private readonly ILogger<TrailService> _logger;
    private readonly TrailResponseFactory _trailResponseFactory;

    public TrailService(IDbContextFactory<StigViddDbContext> context, IWebDavService webDavService, ILogger<TrailService> logger, TrailResponseFactory factory)
    {
        _context = context;
        _webDavService = webDavService;
        _logger = logger;
        _trailResponseFactory = factory;
    }
    public async Task<Result<TrailResponse?>> GetTrailByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var trail = await context.Trails
              .AsNoTracking()
              .Include(t => t.TrailImages)
              .Include(t => t.TrailLinks)
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

    public async Task<Result<IReadOnlyCollection<TrailOverviewResponse?>>> GetPopularTrailOverviewsAsync(CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var trails = await context.Trails
            .Select(trail => TrailOverviewResponse.Create
            (
                trail.Identifier,
                trail.Name,
                trail.TrailLength,
                trail.TrailImages!
                    .Select(trailImages => TrailImageResponse.Create(
                        trailImages.Identifier, 
                        trailImages.ImageUrl))
                    .Take(1)
                    .ToList()
            ))
            .Take(9)
            .ToListAsync(ctoken);

        return Result.Ok<IReadOnlyCollection<TrailOverviewResponse?>>(trails);
    }

    public async Task<Result<TrailResponse?>> AddTrailAsync(
        CreateTrailRequest request,
        IFormFile? trailSymbolImageUrl,
        IFormFileCollection? trailImageUrls,
        CancellationToken ctoken
    )
    {
        using var context = await _context.CreateDbContextAsync(ctoken);
        var trailSymbolUrl = string.Empty;
        var uploadedImageUrls = new List<string>();

        try
        {
            var user = await context.Users.FirstOrDefaultAsync(u => u.Identifier == request.CreatedBy, ctoken);

            if (user == null)
            {
                return Result.Fail<TrailResponse?>(new Message(404, "User not found."));
            }

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
                City = request.City ?? string.Empty,
                CreatedBy = user.Identifier
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

            _logger.LogInformation("Trail added successfully for user: {userId}", user.Id);

            return Result.Ok(_trailResponseFactory?.Create(trail));
        }
        catch (Exception ex)
        {
            var userIdentifier = request.CreatedBy;

            _logger.LogError(ex, "Error adding trail for user: {UserIdentifier}", userIdentifier);

            if (uploadedImageUrls.Count != 0)
            {
                await CleanupUploadedImagesAsync(uploadedImageUrls);
            }
            
            return Result.Fail<TrailResponse?>(new Message(500, "An error occured while adding the trail."));
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
}