// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Infrastructure.Data.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using System.Linq.Expressions;
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
    private readonly TrailContributionRanking _ranking;
    private readonly IMemoryCache _cache;

    private const string PopularContributionsCacheKey = "trails:popular-contributions";

    public TrailService(
        ITrailRepository trailResponseRepository,
        IWebDavService webDavService,
        IMediaUploadService mediaUploadService,
        ILogger<TrailService> logger,
        TrailResponseFactory factory,
        TrailContributionRanking ranking,
        IMemoryCache cache)
    {
        _trailRepository = trailResponseRepository;
        _ranking = ranking;
        _cache = cache;
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
                t.Reviews!.Any() ? t.Reviews!.Average(r => r.Rating) : 0m,
                (decimal?)t.GeoPath!.StartPoint.Coordinate.Y,
                (decimal?)t.GeoPath.StartPoint.Coordinate.X),
            ctoken);

        if (!result.IsSuccess)
            return Result.Fail<IReadOnlyCollection<TrailShortInfoResponse>>(new Message(500, "An error occurred while fetching trails."));

        var trails = result.Value
            .Select(v => TrailShortInfoResponse.Create(
                v.Identifier, v.Name, v.TrailLength, v.Accessibility, v.Classification, v.City, v.AverageRating,
                v.StartLatitude, v.StartLongitude))
            .ToList();

        return Result.Ok<IReadOnlyCollection<TrailShortInfoResponse>>(trails);
    }

    public async Task<Result<IReadOnlyCollection<AdminTrailListItemResponse>>> GetAllTrailsForAdminAsync(CancellationToken ctoken)
    {
        var result = await _trailRepository.GetAllTrailsForAdminAsync(
            t => new AdminTrailListItemResponse
            {
                Identifier = t.Identifier,
                Name = t.Name,
                TrailLength = t.TrailLength,
                Accessibility = t.Accessibility,
                Classification = t.Classification,
                City = t.City,
                IsVerified = t.IsVerified,
                HasImages = t.TrailImages!.Any(),
                // keep-comment: the app badges an image as an example by this same rule (app/src/utils/is-mock-image.ts)
                HasExampleImages = t.TrailImages!.Any(img => img.ImageUrl.ToLower().Contains("mock")),
                HasSymbol = t.TrailSymbolImage != "",
                HasDescription = t.Description != "",
                HasFullDescription = t.FullDescription != "",
                CreatedAt = t.CreatedAt,
                LastUpdatedAt = t.LastUpdatedAt,
            },
            ctoken);

        if (!result.IsSuccess)
            return Result.Fail<IReadOnlyCollection<AdminTrailListItemResponse>>(new Message(500, "An error occurred while fetching trails."));

        return Result.Ok(result.Value);
    }

    public async Task<Result> SetTrailVerifiedAsync(string identifier, bool isVerified, CancellationToken ctoken)
    {
        var result = await _trailRepository.SetTrailVerifiedAsync(identifier, isVerified, ctoken);

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail(new Message(500, "An error occurred while updating the trail."));

        if (!result.IsSuccess)
            return Result.Fail(new Message(404, $"Trail with identifier {identifier} not found."));

        return Result.Ok();
    }

    public async Task<Result<IReadOnlyCollection<TrailMarkerResponse>>> GetAllTrailMarkersAsync(CancellationToken ctoken)
    {
        var result = await _trailRepository.GetAllTrailMarkersAsync(
            t => new TrailMarkerProjection(
                t.Identifier,
                t.Name,
                t.Accessibility,
                (decimal?)t.GeoPath!.StartPoint.Coordinate.Y,
                (decimal?)t.GeoPath.StartPoint.Coordinate.X,
                t.Contribution != null),
            ctoken);

        if (!result.IsSuccess)
            return Result.Fail<IReadOnlyCollection<TrailMarkerResponse>>(new Message(500, "An error occurred while fetching trail markers."));

        var markers = result.Value
            .Select(v => TrailMarkerResponse.Create(v.Identifier, v.Name, v.IsAccessible, v.StartLatitude, v.StartLongitude, v.IsContribution))
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
        var result = await _trailRepository.GetTrailByIdentifierAsync(identifier, TrailResponseSelector(), ctoken);
        return ToTrailResult(result, identifier);
    }

    public async Task<Result<TrailResponse?>> GetTrailForAdminAsync(string identifier, CancellationToken ctoken)
    {
        var result = await _trailRepository.GetTrailByIdentifierForAdminAsync(identifier, TrailResponseSelector(), ctoken);
        return ToTrailResult(result, identifier);
    }

    public async Task<Result<AdminTrailPathResponse>> GetTrailPathForAdminAsync(string identifier, CancellationToken ctoken)
    {
        var result = await _trailRepository.GetTrailPathForAdminAsync(identifier, ctoken);

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail<AdminTrailPathResponse>(new Message(500, "An error occurred while fetching the trail path."));

        if (!result.IsSuccess)
            return Result.Fail<AdminTrailPathResponse>(new Message(404, $"Trail with identifier {identifier} not found."));

        return Result.Ok(AdminTrailPathResponse.Create(result.Value));
    }

    private static Result<TrailResponse?> ToTrailResult(RepositoryResult<TrailWithContributionProjection> result, string identifier)
    {
        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail<TrailResponse?>(new Message(500, "An error occurred while fetching the trail."));

        if (!result.IsSuccess)
            return Result.Fail<TrailResponse?>(new Message(404, $"Trail with identifier {identifier} not found."));

        var trail = result.Value.Trail;
        trail.Contribution = result.Value.Contribution;

        return Result.Ok<TrailResponse?>(trail);
    }

    private Expression<Func<Trail, TrailWithContributionProjection>> TrailResponseSelector() =>
            t => new TrailWithContributionProjection(TrailResponse.Create(
                t.Identifier,
                t.Name,
                t.TrailLength,
                t.Classification,
                t.Accessibility,
                t.AccessibilityInfo,
                t.TrailSymbol,
                t.TrailSymbolImage == ""
                    ? ""
                    : _trailResponseFactory.PresentableBaseUrl + t.TrailSymbolImage,
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
                t.Contribution == null ? null : new TrailContributionResponse
                {
                    SubmitterNickName = t.Contribution.ShowSubmitterName && t.Contribution.SubmittedBy != null
                        ? t.Contribution.SubmittedBy.NickName
                        : null,
                    PublishedAt = t.Contribution.PublishedAt,
                    LikeCount = t.Contribution.Likes.Count,
                });

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
        var result = await _trailRepository.GetTrailByIdentifierAsync(identifier, TrailCardSelector, ctoken);

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail<TrailCardResponse?>(new Message(500, "An error occurred while fetching trail card."));

        if (!result.IsSuccess)
            return Result.Fail<TrailCardResponse?>(new Message(404, $"Trail with identifier {identifier} not found."));

        return Result.Ok<TrailCardResponse?>(ToCard(result.Value));
    }

    public async Task<Result<IReadOnlyCollection<TrailCardResponse>>> GetTrailCardsByIdentifiersAsync(
        IReadOnlyCollection<string> identifiers, CancellationToken ctoken)
    {
        var result = await _trailRepository.GetTrailsByIdentifiersAsync(identifiers, TrailCardSelector, ctoken);

        if (!result.IsSuccess)
            return Result.Fail<IReadOnlyCollection<TrailCardResponse>>(
                new Message(500, "An error occurred while fetching trail cards."));

        return Result.Ok<IReadOnlyCollection<TrailCardResponse>>(result.Value.Select(ToCard).ToList());
    }

    public async Task<Result<IReadOnlyCollection<TrailCardResponse>>> GetPopularContributedTrailsAsync(CancellationToken ctoken)
    {
        // keep-comment: the ranking reads every review and like of every contributed trail, so only the order is cached, not the cards
        if (!_cache.TryGetValue(PopularContributionsCacheKey, out IReadOnlyList<string>? ranked) || ranked is null)
        {
            var inputs = await _trailRepository.GetContributionRankingInputsAsync(ctoken);

            if (!inputs.IsSuccess)
                return Result.Fail<IReadOnlyCollection<TrailCardResponse>>(
                    new Message(500, "An error occurred while fetching popular contributed trails."));

            ranked = _ranking.Rank(inputs.Value, DateTime.UtcNow);
            _cache.Set(PopularContributionsCacheKey, ranked, _ranking.CacheDuration);
        }

        if (ranked.Count == 0)
            return Result.Ok<IReadOnlyCollection<TrailCardResponse>>([]);

        var cards = await _trailRepository.GetTrailsByIdentifiersAsync(ranked, TrailCardSelector, ctoken);

        if (!cards.IsSuccess)
            return Result.Fail<IReadOnlyCollection<TrailCardResponse>>(
                new Message(500, "An error occurred while fetching popular contributed trails."));

        var byIdentifier = cards.Value.ToDictionary(c => c.Identifier);

        return Result.Ok<IReadOnlyCollection<TrailCardResponse>>(ranked
            .Where(byIdentifier.ContainsKey)
            .Select(id => ToCard(byIdentifier[id]))
            .ToList());
    }

    public async Task<Result<TrailLikeResponse>> GetTrailLikeAsync(string trailIdentifier, string userIdentifier, CancellationToken ctoken) =>
        ToLikeResult(await _trailRepository.GetTrailLikeAsync(trailIdentifier, userIdentifier, ctoken), trailIdentifier);

    public async Task<Result<TrailLikeResponse>> SetTrailLikeAsync(string trailIdentifier, string userIdentifier, bool liked, CancellationToken ctoken) =>
        ToLikeResult(await _trailRepository.SetTrailLikeAsync(trailIdentifier, userIdentifier, liked, ctoken), trailIdentifier);

    private static Result<TrailLikeResponse> ToLikeResult(RepositoryResult<TrailLikeState> result, string trailIdentifier)
    {
        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail<TrailLikeResponse>(new Message(500, "An error occurred while updating the like."));

        if (!result.IsSuccess)
            return Result.Fail<TrailLikeResponse>(new Message(404, $"No user-contributed trail with identifier {trailIdentifier}."));

        return Result.Ok(new TrailLikeResponse { LikeCount = result.Value.LikeCount, LikedByMe = result.Value.LikedByMe });
    }

    private TrailCardResponse ToCard(TrailCardProjection v) => TrailCardResponse.Create(
        v.Identifier, v.Name, v.TrailLength, v.Classification, v.Accessibility, v.AverageRating,
        v.Image != null
            ? TrailImageResponse.Create(_trailResponseFactory.PresentableBaseUrl, v.Image.Identifier, v.Image.ImageUrl)
            : null,
        v.Contribution);

    private static readonly Expression<Func<Trail, TrailCardProjection>> TrailCardSelector =
        t => new TrailCardProjection(
            t.Identifier,
            t.Name,
            t.TrailLength,
            t.Classification,
            t.Accessibility,
            t.Reviews!.Any() ? t.Reviews!.Average(r => r.Rating) : 0m,
            t.TrailImages!.Select(i => new TrailCardImageProjection(i.Identifier, i.ImageUrl)).FirstOrDefault(),
            t.Contribution == null ? null : new TrailContributionResponse
            {
                SubmitterNickName = t.Contribution.ShowSubmitterName && t.Contribution.SubmittedBy != null
                    ? t.Contribution.SubmittedBy.NickName
                    : null,
                PublishedAt = t.Contribution.PublishedAt,
                LikeCount = t.Contribution.Likes.Count,
            });

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
            // Coordinates are validated before anything is uploaded, so a rejected trail
            // leaves no files behind.
            var parsedCoordinates = Newtonsoft.Json.JsonConvert.DeserializeObject<WebDataContracts.Coordinate[]>(request.Coordinates);
            if (parsedCoordinates is null || parsedCoordinates.Length < 2)
            {
                return Result.Fail<TrailResponse?>(new Message(400, "Hike coordinates are invalid."));
            }
            var coords = GeoPointFactory.FromLonLatPath(
                parsedCoordinates.Select(c => new NetTopologySuite.Geometries.Coordinate(c.Longitude, c.Latitude)));

            // Uploaded via the media upload service, which strips EXIF/GPS.
            if (trailSymbolImageUrl != null)
            {
                var result = await _mediaUploadService.ProcessAndUploadAsync(
                    trailSymbolImageUrl.OpenReadStream(), "symbols", ImageProcessingOptions.StripMetadataOnly);

                if (result.IsFailure || result.Value == null)
                {
                    await CleanupUploadedImagesAsync(uploadedUrls);
                    return Result.Fail<TrailResponse?>(new Message(500, "Something went wrong, could not create trail. Try again later."));
                }

                trailSymbolUrl = result.Value.Path;
                uploadedUrls.Add(result.Value.Path);
            }

            if (trailImageUrls != null)
            {
                foreach (var image in trailImageUrls)
                {
                    var result = await _mediaUploadService.ProcessAndUploadAsync(
                        image.OpenReadStream(), "trails", ImageProcessingOptions.StripMetadataOnly);

                    if (result.IsFailure || result.Value == null)
                    {
                        await CleanupUploadedImagesAsync(uploadedUrls);
                        return Result.Fail<TrailResponse?>(new Message(500, "Something went wrong, could not create Trail. Try again Later."));
                    }

                    uploadedUrls.Add(result.Value.Path);
                    trailImagePaths.Add(result.Value.Path);
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
                GeoPath = coords,
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
            {
                await CleanupUploadedImagesAsync(uploadedUrls);
                return Result.Fail<TrailResponse?>(new Message(500, "An error occurred while adding the trail."));
            }

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

    public async Task<Result<TrailResponse?>> UpdateTrailAsync(UpdateTrailRequest request, string trailIdentifier, CancellationToken ctoken)
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

        if (request.Links != null)
        {
            trail.TrailLinks = request.Links
                .Select(link => new TrailLink
                {
                    Identifier = link.Identifier ?? Guid.NewGuid().ToString(),
                    Title = link.Title.Trim(),
                    Link = link.Link.Trim(),
                })
                .ToList();
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

internal record TrailWithContributionProjection(TrailResponse Trail, TrailContributionResponse? Contribution);

internal record TrailCardProjection(
    string Identifier, string Name, decimal TrailLength,
    int Classification, bool Accessibility, decimal AverageRating,
    TrailCardImageProjection? Image, TrailContributionResponse? Contribution = null);

internal record TrailCardImageProjection(string Identifier, string ImageUrl);

internal record TrailMarkerProjection(
    string Identifier, string Name, bool IsAccessible,
    decimal? StartLatitude, decimal? StartLongitude, bool IsContribution = false);

internal record TrailShortInfoProjection(
    string Identifier, string Name, decimal TrailLength, bool Accessibility,
    int? Classification, string City, decimal AverageRating,
    decimal? StartLatitude, decimal? StartLongitude);

internal record TrailOverviewProjection(
    string Identifier, string Name, decimal TrailLength, decimal AverageRating,
    TrailCardImageProjection? Image);
