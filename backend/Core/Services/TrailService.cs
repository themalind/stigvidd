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
    private readonly IMediaUploadService _mediaUploadService;
    private readonly ILogger<TrailService> _logger;
    private readonly TrailResponseFactory _trailResponseFactory;
    private readonly ITrailRepository _trailRepository;

    public TrailService(
        ITrailRepository trailResponseRepository,
        IWebDavService webDavService,
        IMediaUploadService mediaUploadService,
        ILogger<TrailService> logger,
        TrailResponseFactory factory)
    {
        _trailRepository = trailResponseRepository;
        _webDavService = webDavService;
        _mediaUploadService = mediaUploadService;
        _logger = logger;
        _trailResponseFactory = factory;
    }
    public async Task<Result<IReadOnlyCollection<TrailShortInfoResponse>>> GetAllTrailsWithBasicInfoAsync(CancellationToken ctoken)
    {
        var result = await _trailRepository.GetAllTrailsWithBasicInfoAsync(
            t => new TrailShortInfoProjection(
                t.Identifier,
                t.Name,
                t.TrailLength,
                t.Accessibility,
                t.Classification,
                t.City,
                (decimal?)t.GeoPath!.StartPoint.Coordinate.Y,
                (decimal?)t.GeoPath.StartPoint.Coordinate.X),
            ctoken);

        if (!result.IsSuccess)
            return Result.Fail<IReadOnlyCollection<TrailShortInfoResponse>>(new Message(500, "An error occurred while fetching trails."));

        var trails = result.Value
            .Select(v => TrailShortInfoResponse.Create(
                v.Identifier, v.Name, v.TrailLength, v.Accessibility, v.Classification, v.City, v.StartLatitude, v.StartLongitude))
            .ToList();

        return Result.Ok<IReadOnlyCollection<TrailShortInfoResponse>>(trails);
    }

    public async Task<Result<IReadOnlyCollection<TrailMarkerResponse>>> GetAllTrailMarkersAsync(CancellationToken ctoken)
    {
        var result = await _trailRepository.GetAllTrailMarkersAsync(
            t => new TrailMarkerProjection(
                t.Identifier,
                t.Name,
                t.Accessibility,
                (decimal?)t.GeoPath!.StartPoint.Coordinate.Y,
                (decimal?)t.GeoPath.StartPoint.Coordinate.X),
            ctoken);

        if (!result.IsSuccess)
            return Result.Fail<IReadOnlyCollection<TrailMarkerResponse>>(new Message(500, "An error occurred while fetching trail markers."));

        var markers = result.Value
            .Select(v => TrailMarkerResponse.Create(v.Identifier, v.Name, v.IsAccessible, v.StartLatitude, v.StartLongitude))
            .ToList();

        return Result.Ok<IReadOnlyCollection<TrailMarkerResponse>>(markers);
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
                t.TrailLinks!.Select(link => TrailLinkResponse.Create(link.Identifier, link.Link, link.Title)).ToList(),
                t.VisitorInformation != null ? VisitorInformationResponse.Create(
                    t.VisitorInformation.Identifier,
                    t.VisitorInformation.GettingThere,
                    t.VisitorInformation.PublicTransport,
                    t.VisitorInformation.Parking,
                    t.VisitorInformation.Illumination,
                    t.VisitorInformation.IlluminationText,
                    t.VisitorInformation.MaintainedBy,
                    t.VisitorInformation.WinterMaintenance) : null),
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

    public async Task<Result<TrailCardResponse?>> GetTrailCardByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        var result = await _trailRepository.GetTrailByIdentifierAsync(
            identifier,
            t => new TrailCardProjection(
                t.Identifier,
                t.Name,
                t.TrailLength,
                t.Classification,
                t.Accessibility,
                t.Reviews!.Any() ? t.Reviews!.Average(r => r.Rating) : 0m,
                t.TrailImages!.Select(i => new TrailCardImageProjection(i.Identifier, i.ImageUrl)).FirstOrDefault()),
            ctoken);

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail<TrailCardResponse?>(new Message(500, "An error occurred while fetching trail card."));

        if (!result.IsSuccess)
            return Result.Fail<TrailCardResponse?>(new Message(404, $"Trail with identifier {identifier} not found."));

        var v = result.Value;
        var image = v.Image != null
            ? TrailImageResponse.Create(_trailResponseFactory.PresentableBaseUrl, v.Image.Identifier, v.Image.ImageUrl)
            : null;

        return Result.Ok<TrailCardResponse?>(TrailCardResponse.Create(
            v.Identifier, v.Name, v.TrailLength, v.Classification, v.Accessibility, v.AverageRating, image));
    }

    public async Task<Result<IReadOnlyCollection<TrailCardResponse>>> GetTrailCardsByIdentifiersAsync(
        IReadOnlyCollection<string> identifiers, CancellationToken ctoken)
    {
        var result = await _trailRepository.GetTrailsByIdentifiersAsync(
            identifiers,
            t => new TrailCardProjection(
                t.Identifier,
                t.Name,
                t.TrailLength,
                t.Classification,
                t.Accessibility,
                t.Reviews!.Any() ? t.Reviews!.Average(r => r.Rating) : 0m,
                t.TrailImages!.Select(i => new TrailCardImageProjection(i.Identifier, i.ImageUrl)).FirstOrDefault()),
            ctoken);

        if (!result.IsSuccess)
            return Result.Fail<IReadOnlyCollection<TrailCardResponse>>(
                new Message(500, "An error occurred while fetching trail cards."));

        var cards = result.Value
            .Select(v => TrailCardResponse.Create(
                v.Identifier, v.Name, v.TrailLength, v.Classification, v.Accessibility, v.AverageRating,
                v.Image != null
                    ? TrailImageResponse.Create(_trailResponseFactory.PresentableBaseUrl, v.Image.Identifier, v.Image.ImageUrl)
                    : null))
            .ToList();

        return Result.Ok<IReadOnlyCollection<TrailCardResponse>>(cards);
    }

    public async Task<Result<IReadOnlyCollection<TrailOverviewResponse?>>> GetPopularTrailOverviewsAsync(
        double? userLatitude, double? userLongitude, CancellationToken ctoken)
    {
        var result = await _trailRepository.GetPopularTrailOverviewsAsync(
            userLatitude,
            userLongitude,
            t => new TrailOverviewProjection(
                t.Identifier,
                t.Name,
                t.TrailLength,
                t.Reviews!.Any() ? t.Reviews!.Average(r => r.Rating) : 0m,
                t.TrailImages!.Select(i => new TrailCardImageProjection(i.Identifier, i.ImageUrl)).FirstOrDefault()),
            ctoken);

        if (!result.IsSuccess)
            return Result.Fail<IReadOnlyCollection<TrailOverviewResponse?>>(new Message(500, "An error occurred while fetching popular trails."));

        var overviews = result.Value
            .Select(v => TrailOverviewResponse.Create(
                v.Identifier,
                v.Name,
                v.TrailLength,
                v.AverageRating,
                v.Image != null
                    ? [TrailImageResponse.Create(_trailResponseFactory.PresentableBaseUrl, v.Image.Identifier, v.Image.ImageUrl)]
                    : Array.Empty<TrailImageResponse>()))
            .ToList();

        return Result.Ok<IReadOnlyCollection<TrailOverviewResponse?>>(overviews);
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

        if (request.VisitorInformation != null)
        {
            trail.VisitorInformation = new VisitorInformation
            {
                GettingThere = request.VisitorInformation.GettingThere ?? string.Empty,
                PublicTransport = request.VisitorInformation.PublicTransport ?? string.Empty,
                Parking = request.VisitorInformation.Parking ?? string.Empty,
                Illumination = request.VisitorInformation.Illumination ?? false,
                IlluminationText = request.VisitorInformation.IlluminationText ?? string.Empty,
                MaintainedBy = request.VisitorInformation.MaintainedBy ?? string.Empty,
                WinterMaintenance = request.VisitorInformation.WinterMaintenance ?? false,
            };
        }

        var result = await _trailRepository.UpdateTrailAsync(trail, ctoken);

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail<TrailResponse?>(new Message(500, "An error occurred while updating the trail."));

        if (!result.IsSuccess)
            return Result.Fail<TrailResponse?>(new Message(404, $"Trail with identifier {trailIdentifier} not found."));

        return Result.Ok<TrailResponse?>(_trailResponseFactory.Create(result.Value));
    }

    public async Task<Result<IReadOnlyCollection<TrailImageResponse>>> AddTrailImagesAsync(
        string trailIdentifier,
        IFormFileCollection images,
        ImageProcessingOptions options,
        CancellationToken ctoken)
    {
        var uploadedUrls = new List<string>();

        try
        {
            var trailIdResult = await _trailRepository.GetTrailIdByIdentifierAsync(trailIdentifier, ctoken);

            if (trailIdResult.Status == RepositoryResultStatus.Error)
                return Result.Fail<IReadOnlyCollection<TrailImageResponse>>(new Message(500, "An error occurred while fetching the trail."));

            if (!trailIdResult.IsSuccess)
                return Result.Fail<IReadOnlyCollection<TrailImageResponse>>(new Message(404, $"Trail with identifier {trailIdentifier} not found."));

            var trailImages = new List<TrailImage>();

            foreach (var image in images)
            {
                var uploadResult = await _mediaUploadService.ProcessAndUploadAsync(image.OpenReadStream(), "trails", options);

                if (uploadResult.IsFailure || uploadResult.Value == null)
                    return Result.Fail<IReadOnlyCollection<TrailImageResponse>>(new Message(500, "Something went wrong uploading images. Try again later."));

                uploadedUrls.Add(uploadResult.Value.Path);
                trailImages.Add(new TrailImage
                {
                    ImageUrl = uploadResult.Value.Path,
                    Width = uploadResult.Value.Width,
                    Height = uploadResult.Value.Height,
                    SizeBytes = uploadResult.Value.SizeBytes
                });
            }

            var addResult = await _trailRepository.AddTrailImagesAsync(trailIdResult.Value, trailImages, ctoken);

            if (!addResult.IsSuccess)
                return Result.Fail<IReadOnlyCollection<TrailImageResponse>>(new Message(500, "An error occurred while saving images."));

            IReadOnlyCollection<TrailImageResponse> response = addResult.Value
                .Select(img => TrailImageResponse.Create(
                    _trailResponseFactory.PresentableBaseUrl, img.Identifier, img.ImageUrl,
                    img.AltText, img.Caption, img.Width, img.Height, img.SizeBytes))
                .ToList();

            return Result.Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailService: AddTrailImagesAsync -> Error adding images to trail {TrailIdentifier}", trailIdentifier);

            if (uploadedUrls.Count != 0)
                await CleanupUploadedImagesAsync(uploadedUrls);

            return Result.Fail<IReadOnlyCollection<TrailImageResponse>>(new Message(500, "An error occurred while adding images."));
        }
    }

    public async Task<Result<string>> SetTrailSymbolAsync(
        string trailIdentifier,
        IFormFile symbol,
        ImageProcessingOptions options,
        CancellationToken ctoken)
    {
        string? uploadedPath = null;

        try
        {
            var uploadResult = await _mediaUploadService.ProcessAndUploadAsync(symbol.OpenReadStream(), "symbols", options);

            if (uploadResult.IsFailure || uploadResult.Value == null)
                return Result.Fail<string>(new Message(500, "Something went wrong uploading the trail symbol. Try again later."));

            uploadedPath = uploadResult.Value.Path;

            var updateResult = await _trailRepository.UpdateTrailSymbolAsync(trailIdentifier, uploadedPath, ctoken);

            if (updateResult.Status == RepositoryResultStatus.Error)
                return Result.Fail<string>(new Message(500, "An error occurred while updating the trail symbol."));

            if (!updateResult.IsSuccess)
                return Result.Fail<string>(new Message(404, $"Trail with identifier {trailIdentifier} not found."));

            return Result.Ok($"{_trailResponseFactory.PresentableBaseUrl}{uploadedPath}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailService: SetTrailSymbolAsync -> Error setting symbol for trail {TrailIdentifier}", trailIdentifier);

            if (uploadedPath != null)
                await CleanupUploadedImagesAsync([uploadedPath]);

            return Result.Fail<string>(new Message(500, "An error occurred while setting the trail symbol."));
        }
    }

    public async Task<Result> DeleteTrailImageAsync(string imageIdentifier, CancellationToken ctoken)
    {
        var result = await _trailRepository.DeleteTrailImageAsync(imageIdentifier, ctoken);

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail(new Message(500, "An error occurred while deleting the image."));

        if (!result.IsSuccess)
            return Result.Fail(new Message(404, $"Image with identifier {imageIdentifier} not found."));

        return Result.Ok();
    }
}

internal record TrailCardProjection(
    string Identifier, string Name, decimal TrailLength,
    int Classification, bool Accessibility, decimal AverageRating,
    TrailCardImageProjection? Image);

internal record TrailCardImageProjection(string Identifier, string ImageUrl);

internal record TrailMarkerProjection(
    string Identifier, string Name, bool IsAccessible,
    decimal? StartLatitude, decimal? StartLongitude);

internal record TrailShortInfoProjection(
    string Identifier, string Name, decimal TrailLength, bool Accessibility,
    int? Classification, string City, decimal? StartLatitude, decimal? StartLongitude);

internal record TrailOverviewProjection(
    string Identifier, string Name, decimal TrailLength, decimal AverageRating,
    TrailCardImageProjection? Image);
