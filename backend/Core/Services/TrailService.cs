using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Infrastructure.Data.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using WebDataContracts.RequestModels.Trail;
using WebDataContracts.ResponseModels.Trail;

namespace Core.Services;

public class TrailService : ITrailService
{
    private readonly IWebDavService _webDavService;
    private readonly ILogger<TrailService> _logger;
    private readonly TrailResponseFactory _trailResponseFactory;
    private readonly ITrailRepository _trailRepository;

    public TrailService(
        ITrailRepository trailResponseRepository,
        IWebDavService webDavService,
        ILogger<TrailService> logger,
        TrailResponseFactory factory)
    {
        _trailRepository = trailResponseRepository;
        _webDavService = webDavService;
        _logger = logger;
        _trailResponseFactory = factory;
    }

    public async Task<Result<int>> GetTrailIdByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        var result = await _trailRepository.GetTrailIdByIdentifierAsync(identifier, ctoken);

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail<int>(new Message(500, "An error occurred while fetching the trail."));

        if (!result.IsSuccess)
            return Result.Fail<int>(new Message(404, $"Trail with identifier {identifier} not found."));

        return Result.Ok(result.Value);
    }

    public async Task<Result<TrailResponse?>> GetTrailByIdentifierWithoutCoordinatesAsync(string identifier, CancellationToken ctoken)
    {
        var result = await _trailRepository.GetTrailByIdentifierAsync(
            identifier,
            t => TrailResponse.Create(
                t.Identifier,
                t.Name,
                t.TrailLength,
                t.Classification,
                t.Accessibility,
                t.AccessibilityInfo,
                t.TrailSymbol,
                t.TrailSymbolImage,
                t.Description,
                t.FullDescription,
                t.Tags,
                t.CreatedBy!,
                t.IsVerified, t.City,
                t.TrailImages!.Select(img => TrailImageResponse.Create(
                    _trailResponseFactory.PresentableBaseUrl,
                    img.Identifier,
                    img.ImageUrl)).ToList(),
                t.TrailLinks!.Select(link => new TrailLinkResponse
                {
                    Identifier = link.Identifier,
                    Link = link.Link,
                    Title = link.Title
                }).ToList(),
                t.VisitorInformation != null ? new VisitorInformationResponse
                {
                    Identifier = t.VisitorInformation.Identifier,
                    GettingThere = t.VisitorInformation.GettingThere,
                    PublicTransport = t.VisitorInformation.PublicTransport,
                    Parking = t.VisitorInformation.Parking,
                    Illumination = t.VisitorInformation.Illumination,
                    IlluminationText = t.VisitorInformation.IlluminationText,
                    MaintainedBy = t.VisitorInformation.MaintainedBy,
                    WinterMaintenance = t.VisitorInformation.WinterMaintenance
                } : null),
            ctoken);

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail<TrailResponse?>(new Message(500, "An error occurred while fetching the trail."));

        if (!result.IsSuccess)
            return Result.Fail<TrailResponse?>(new Message(404, $"Trail with identifier {identifier} not found."));

        return Result.Ok<TrailResponse?>(result.Value);
    }

    public async Task<Result<CoordinatesResponse?>> GetCoordinatesByTrailIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        var result = await _trailRepository.GetCoordinatesByTrailIdentifierAsync(identifier, ctoken);

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail<CoordinatesResponse?>(new Message(500, "An error occurred while fetching coordinates."));

        if (!result.IsSuccess)
            return Result.Fail<CoordinatesResponse?>(new Message(404, $"Coordinates with Trail identifier: {identifier} not found."));

        return Result.Ok<CoordinatesResponse?>(CoordinatesResponse.Create(result.Value));
    }

    public async Task<Result<IReadOnlyCollection<TrailOverviewResponse?>>> GetPopularTrailOverviewsAsync(
        double? userLatitude, double? userLongitude, CancellationToken ctoken)
    {
        var result = await _trailRepository.GetPopularTrailOverviewsAsync(_trailResponseFactory.PresentableBaseUrl, userLatitude, userLongitude, ctoken);

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail<IReadOnlyCollection<TrailOverviewResponse?>>(new Message(500, "An error occurred while fetching popular trails."));

        return Result.Ok<IReadOnlyCollection<TrailOverviewResponse?>>(result.Value ?? []);
    }

    public async Task<Result<TrailResponse?>> AddTrailAsync(
        CreateTrailRequest request,
        IFormFile? trailSymbolImageUrl,
        IFormFileCollection? trailImageUrls,
        string userIdentifier,
        CancellationToken ctoken)
    {
        var trailSymbolUrl = string.Empty;
        var uploadedUrls = new List<string>();
        var trailImagePaths = new List<string>();

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
                    uploadedUrls.Add(result.Value);
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
                    {
                        uploadedUrls.Add(result.Value);
                        trailImagePaths.Add(result.Value);
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

            if (trailImagePaths.Count != 0)
            {
                trail.TrailImages = trailImagePaths
                    .Select(url => new TrailImage { ImageUrl = url, Trail = trail })
                    .ToList();
            }

            var addResult = await _trailRepository.AddTrailAsync(trail, ctoken);

            if (!addResult.IsSuccess)
                return Result.Fail<TrailResponse?>(new Message(500, "An error occurred while adding the trail."));

            return Result.Ok<TrailResponse?>(_trailResponseFactory.Create(addResult.Value));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding trail for user: {userIdentifier}", userIdentifier);

            if (uploadedUrls.Count != 0)
                await CleanupUploadedImagesAsync(uploadedUrls);

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

    public async Task<Result<TrailResponse?>> UpdateTrailAsync(UpdateTrailRequest request, string trailIdentifier, string userIdentifier, CancellationToken ctoken)
    {
        var trail = new Trail
        {
            Identifier = trailIdentifier,
            Name = request.Name,
            TrailLength = request.TrailLength,
            Classification = request.Classification ?? 0,
            Accessibility = request.Accessibility ?? false,
            AccessibilityInfo = request.AccessibilityInfo ?? string.Empty,
            TrailSymbol = request.TrailSymbol ?? string.Empty,
            Description = request.Description ?? string.Empty,
            FullDescription = request.FullDescription ?? string.Empty,
            Tags = request.Tags ?? string.Empty,
            City = request.City ?? string.Empty,
        };

        var result = await _trailRepository.UpdateTrailAsync(trail, ctoken);

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail<TrailResponse?>(new Message(500, "An error occurred while updating the trail."));

        if (!result.IsSuccess)
            return Result.Fail<TrailResponse?>(new Message(404, $"Trail with identifier {trailIdentifier} not found."));

        return Result.Ok<TrailResponse?>(_trailResponseFactory.Create(result.Value));
    }

    public async Task<Result<IReadOnlyCollection<TrailShortInfoResponse>>> GetAllTrailsWithBasicInfoAsync(CancellationToken ctoken)
    {
        var result = await _trailRepository.GetAllTrailsWithBasicInfoAsync(ctoken);

        if (!result.IsSuccess)
            return Result.Fail<IReadOnlyCollection<TrailShortInfoResponse>>(new Message(500, "An error occurred while fetching trails."));

        return Result.Ok(result.Value);
    }

    public async Task<Result<IReadOnlyCollection<TrailMarkerResponse>>> GetAllTrailMarkersAsync(CancellationToken ctoken)
    {
        var result = await _trailRepository.GetAllTrailMarkersAsync(ctoken);

        if (!result.IsSuccess)
            return Result.Fail<IReadOnlyCollection<TrailMarkerResponse>>(new Message(500, "An error occurred while fetching trail markers."));

        return Result.Ok(result.Value);
    }
}
