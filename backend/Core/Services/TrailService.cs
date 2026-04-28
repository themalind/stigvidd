using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Infrastructure.Data.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using WebDataContracts.RequestModels.Trail;
using WebDataContracts.ResponseModels.Trail;

namespace Core.Services;

public class TrailService : ITrailService
{
    private readonly string _presentableBaseUrl;
    private readonly IWebDavService _webDavService;
    private readonly ILogger<TrailService> _logger;
    private readonly TrailResponseFactory _trailResponseFactory;
    private readonly ITrailResponseRepository _trailResponseRepository;

    public TrailService(
        ITrailResponseRepository trailResponseRepository,
        IWebDavService webDavService,
        ILogger<TrailService> logger,
        TrailResponseFactory factory,
        IConfiguration configuration)
    {
        _trailResponseRepository = trailResponseRepository;
        _presentableBaseUrl = configuration["PresentableBaseUrl"] ?? throw new InvalidOperationException("PresentableBaseUrl configuration is missing");
        _webDavService = webDavService;
        _logger = logger;
        _trailResponseFactory = factory;
    }

    public async Task<Result<int>> GetTrailIdByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        var result = await _trailResponseRepository.GetTrailIdByIdentifierAsync(identifier, ctoken);

        if (!result.IsSuccess)
        {
            _logger.LogWarning("Trail with identifier {identifier} not found.", identifier);
            return Result.Fail<int>(new Message(404, $"Trail with identifier {identifier} not found."));
        }

        return Result.Ok(result.Value);
    }

    public async Task<Result<TrailResponse?>> GetTrailByIdentifierWithoutCoordinatesAsync(string identifier, CancellationToken ctoken)
    {
        try
        {
            var result = await _trailResponseRepository.GetTrailByIdentifierWithoutCoordinatesAsync(identifier, ctoken);

            if (!result.IsSuccess)
            {
                _logger.LogInformation("TrailService -> GetTrailByIdentifierWithoutCoordinatesAsync: Trail with identifier ${Identifier} not found.", identifier);
                return Result.Fail<TrailResponse?>(new Message(404, $"Trail with identifier {identifier} not found."));
            }

            return Result.Ok<TrailResponse?>(result.Value);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching trail with identifier: {Identifier}", identifier);
            return Result.Fail<TrailResponse?>(new Message(500, "An error occurred while fetching the trail."));
        }
    }

    public async Task<Result<CoordinatesResponse?>> GetCoordinatesByTrailIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        try
        {
            var result = await _trailResponseRepository.GetCoordinatesByTrailIdentifierAsync(identifier, ctoken);

            if (!result.IsSuccess)
            {
                _logger.LogInformation("TrailService -> GetCoordinatesByTrailIdentifierAsync: Coordinates with Trail identifier: {Identifier} not found.", identifier);
                return Result.Fail<CoordinatesResponse?>(new Message(404, $"Coordinates with Trail identifier: {identifier} not found."));
            }

            return Result.Ok<CoordinatesResponse?>(CoordinatesResponse.Create(result.Value));
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
        try
        {
            var result = await _trailResponseRepository.GetPopularTrailOverviewsAsync(userLatitude, userLongitude, ctoken);

            return Result.Ok<IReadOnlyCollection<TrailOverviewResponse?>>(result.Value!);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching popular trail overviews.");
            return Result.Fail<IReadOnlyCollection<TrailOverviewResponse?>>(new Message(500, "An error occurred while fetching popular trails."));
        }
    }

    public async Task<Result<TrailResponse?>> AddTrailAsync(
        CreateTrailRequest request,
        IFormFile? trailSymbolImageUrl,
        IFormFileCollection? trailImageUrls,
        string userIdentifier,
        CancellationToken ctoken)
    {
        var trailSymbolUrl = string.Empty;
        var uploadedImageUrls = new List<string>();

        try
        {
            if (trailSymbolImageUrl != null)
            {
                var result = await _webDavService.UploadFileAsync(trailSymbolImageUrl.OpenReadStream(), "symbols");

                if (result.IsFailure)
                    return Result.Fail<TrailResponse?>(new Message(500, "Something went wrong, could not create trail. Try again later."));

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
                        return Result.Fail<TrailResponse?>(new Message(500, "Something went wrong, could not create Trail. Try again Later."));

                    if (result.Value != null)
                        uploadedImageUrls.Add(result.Value);
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
                trail.TrailImages = uploadedImageUrls
                    .Select(url => new TrailImage { ImageUrl = url })
                    .ToList();
            }

            var addResult = await _trailResponseRepository.AddTrailAsync(trail, ctoken);

            if (!addResult.IsSuccess)
                return Result.Fail<TrailResponse?>(new Message(500, "An error occurred while adding the trail."));

            _logger.LogInformation("Trail added successfully for user: {userIdentifier}", userIdentifier);

            return Result.Ok<TrailResponse?>(_trailResponseFactory.Create(addResult.Value));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding trail for user: {userIdentifier}", userIdentifier);

            if (uploadedImageUrls.Count != 0)
                await CleanupUploadedImagesAsync(uploadedImageUrls);

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
        try
        {
            var result = await _trailResponseRepository.GetAllTrailsWithBasicInfoAsync(ctoken);

            if (!result.IsSuccess)
                return Result.Fail<IReadOnlyCollection<TrailShortInfoResponse>>(new Message(500, "An error occurred while fetching trails."));

            return Result.Ok(result.Value);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching trails with basic info.");
            return Result.Fail<IReadOnlyCollection<TrailShortInfoResponse>>(new Message(500, "An error occurred while fetching trails."));
        }
    }

    public async Task<Result<IReadOnlyCollection<TrailMarkerResponse>>> GetAllTrailMarkersAsync(CancellationToken ctoken)
    {
        try
        {
            var result = await _trailResponseRepository.GetAllTrailMarkersAsync(ctoken);

            if (!result.IsSuccess)
                return Result.Fail<IReadOnlyCollection<TrailMarkerResponse>>(new Message(500, "An error occurred while fetching trail markers."));

            return Result.Ok(result.Value);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching trail markers.");
            return Result.Fail<IReadOnlyCollection<TrailMarkerResponse>>(new Message(500, "An error occurred while fetching trail markers."));
        }
    }
}
