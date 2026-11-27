// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Interfaces.Repositories.Trails.Models;
using Core.Interfaces.Services;
using Core.Telemetry;
using Infrastructure.Data.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using System.Runtime.CompilerServices;
using WebDataContracts.RequestModels.Review;
using WebDataContracts.ResponseModels.Review;

namespace Core.Services.Trails;

public class ReviewService : IReviewService
{
    // keep-comment: must match MAX_REVIEW_IMAGES in the app
    public const int MaxReviewImages = 3;

    private readonly IReviewRepository _reviewRepository;
    private readonly IWebDavService _webDavService;
    private readonly IMediaUploadService _mediaUploadService;
    private readonly IUserRepository _userRepository;
    private readonly IUserBlockService _userBlockService;
    private readonly ITrailService _trailService;
    private readonly ReviewResponseFactory _reviewResponseFactory;
    private readonly ILogger<ReviewService> _logger;
    private readonly StigviddMetrics _metrics;

    public ReviewService(
        IReviewRepository reviewRepository,
        IWebDavService webDavService,
        IMediaUploadService mediaUploadService,
        IUserRepository userRepository,
        IUserBlockService userBlockService,
        ITrailService trailService,
        ReviewResponseFactory reviewResponseFactory,
        ILogger<ReviewService> logger,
        StigviddMetrics metrics)
    {
        _reviewRepository = reviewRepository;
        _webDavService = webDavService;
        _mediaUploadService = mediaUploadService;
        _userRepository = userRepository;
        _userBlockService = userBlockService;
        _trailService = trailService;
        _reviewResponseFactory = reviewResponseFactory;
        _logger = logger;
        _metrics = metrics;
    }

    public async Task<Result<PagedReviewResponse>> GetReviewsByTrailIdentifierAsync(
        string trailIdentifier,
        int page,
        int limit,
        string? viewerIdentifier,
        CancellationToken ctoken)
    {
        var baseUrl = _reviewResponseFactory.PresentableBaseUrl;
        var hiddenUserIds = await _userBlockService.GetHiddenUserIdsForReadAsync(viewerIdentifier, ctoken);

        var result = await _reviewRepository.GetReviewsByTrailIdentifierAsync(
            trailIdentifier, page, limit, hiddenUserIds,
            r => ReviewResponse.Create(
                r.Identifier,
                r.TrailReview,
                r.Rating,
                r.User != null ? r.User.NickName : null,
                r.CreatedAt,
                ReviewResponseFactory.EditedAt(r.CreatedAt, r.LastUpdatedAt),
                r.Trail != null ? r.Trail.Identifier : string.Empty,
                r.User != null ? r.User.Identifier : null,
                r.ReviewImages!.Select(img => ReviewImageResponse.Create(baseUrl, img.Identifier, img.ImageUrl)).ToList()),
            ctoken);

        if (!result.IsSuccess)
            return Result.Fail<PagedReviewResponse>(new Message(500, "An error occurred while fetching reviews."));

        return Result.Ok(new PagedReviewResponse
        {
            Reviews = result.Value.Items,
            Page = result.Value.Page,
            HasMore = result.Value.HasMore,
            Total = result.Value.TotalCount
        });
    }

    public async Task<Result<ReviewResponse>> GetOwnReviewAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken)
    {
        var result = await _reviewRepository.GetReviewByTrailAndUserAsync(trailIdentifier, userIdentifier, ctoken);

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail<ReviewResponse>(FetchFailed());

        if (!result.IsSuccess)
            return Result.Fail<ReviewResponse>(ReviewNotFound());

        return Result.Ok(_reviewResponseFactory.Create(result.Value));
    }

    public async Task<Result<ReviewResponse?>> AddReviewAsync(
        string userIdentifier,
        string trailIdentifier,
        string? trailReview,
        decimal rating,
        IFormFileCollection? imageUrls,
        CancellationToken ctoken)
    {
        var result = await AddReviewCoreAsync(
            userIdentifier, trailIdentifier, trailReview, rating, imageUrls, ctoken);

        // Measured out here rather than at each of the seven exits below, so that every path —
        // including the catch, and including an eighth exit somebody adds next year — is counted
        // exactly once without anyone having to remember.
        _metrics.RecordReviewChange(MetricTags.Values.OperationAdd, MetricOutcome.From(result));

        if (result.Success)
        {
            _metrics.RecordReviewRating(rating);
        }

        return result;
    }

    private async Task<Result<ReviewResponse?>> AddReviewCoreAsync(
        string userIdentifier,
        string trailIdentifier,
        string? trailReview,
        decimal rating,
        IFormFileCollection? imageUrls,
        CancellationToken ctoken)
    {
        var uploadedUrls = new List<string>();

        try
        {
            if (rating < 1M || rating > 5M)
                return Result.Fail<ReviewResponse?>(new Message(400, "Rating must be between 1 and 5."));

            // User and trail are resolved before anything is uploaded, so a rejected review
            // leaves no files behind.
            var userResult = await _userRepository.GetUserIdByIdentifierAsync(userIdentifier, ctoken);

            if (!userResult.IsSuccess)
                return Result.Fail<ReviewResponse?>(new Message(404, "User not found."));

            var trailResult = await _trailService.GetTrailIdByIdentifierAsync(trailIdentifier, ctoken);

            if (!trailResult.Success)
                return Result.Fail<ReviewResponse?>(new Message(404, "Trail not found."));

            // One review per user and trail, checked before the upload so nothing is left behind.
            var existingResult = await _reviewRepository.HasUserReviewedTrailAsync(trailResult.Value, userResult.Value, ctoken);

            if (!existingResult.IsSuccess)
                return Result.Fail<ReviewResponse?>(AddFailed());

            if (existingResult.Value)
                return Result.Fail<ReviewResponse?>(AlreadyReviewed());

            if ((imageUrls?.Count ?? 0) > MaxReviewImages)
                return Result.Fail<ReviewResponse?>(TooManyImages());

            if (!await UploadImagesAsync(imageUrls, uploadedUrls))
            {
                await DeleteImageFilesAsync(uploadedUrls, $"Rollback of a failed review upload. UserIdentifier: {userIdentifier}, TrailIdentifier: {trailIdentifier}");
                return Result.Fail<ReviewResponse?>(new Message(500, "Something went wrong, could not create review. Try again later."));
            }

            var review = new Review
            {
                TrailReview = NormaliseText(trailReview),
                Rating = rating,
                TrailId = trailResult.Value,
                UserId = userResult.Value,
            };

            if (uploadedUrls.Count != 0)
            {
                review.ReviewImages = uploadedUrls
                    .Select(url => new ReviewImage { ImageUrl = url, Review = review })
                    .ToList();
            }

            var addResult = await _reviewRepository.AddReviewAsync(review, ctoken);

            if (!addResult.IsSuccess)
            {
                await DeleteImageFilesAsync(uploadedUrls, $"Rollback of a review that could not be saved. UserIdentifier: {userIdentifier}, TrailIdentifier: {trailIdentifier}");
                return Result.Fail<ReviewResponse?>(addResult.Status == RepositoryResultStatus.Conflict ? AlreadyReviewed() : AddFailed());
            }

            return Result.Ok<ReviewResponse?>(_reviewResponseFactory.Create(addResult.Value));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding review for User: {UserIdentifier}, Trail: {TrailIdentifier}", userIdentifier, trailIdentifier);

            if (uploadedUrls.Any())
                await DeleteImageFilesAsync(uploadedUrls, $"Rollback of a failed review upload. UserIdentifier: {userIdentifier}, TrailIdentifier: {trailIdentifier}");

            return Result.Fail<ReviewResponse?>(AddFailed());
        }
    }

    public async Task<Result<ReviewResponse>> UpdateReviewAsync(
        string reviewIdentifier,
        string userIdentifier,
        UpdateReviewRequest request,
        IFormFileCollection? newImages,
        CancellationToken ctoken)
    {
        var result = await UpdateReviewCoreAsync(reviewIdentifier, userIdentifier, request, newImages, ctoken);

        _metrics.RecordReviewChange(MetricTags.Values.OperationUpdate, MetricOutcome.From(result));

        return result;
    }

    private async Task<Result<ReviewResponse>> UpdateReviewCoreAsync(
        string reviewIdentifier,
        string userIdentifier,
        UpdateReviewRequest request,
        IFormFileCollection? newImages,
        CancellationToken ctoken)
    {
        var uploadedUrls = new List<string>();
        var saved = false;
        var logContext = $"ReviewIdentifier: {reviewIdentifier}, UserIdentifier: {userIdentifier}";

        try
        {
            var reviewResult = await _reviewRepository.GetReviewByIdentifierAsync(reviewIdentifier, userIdentifier, ctoken);

            if (reviewResult.Status == RepositoryResultStatus.Error)
                return Result.Fail<ReviewResponse>(UpdateFailed());

            if (!reviewResult.IsSuccess)
                return Result.Fail<ReviewResponse>(ReviewNotFound());

            var currentImages = reviewResult.Value.ReviewImages ?? [];
            var removedIdentifiers = (request.RemovedImageIdentifiers ?? []).ToHashSet();

            if (!removedIdentifiers.All(identifier => currentImages.Any(image => image.Identifier == identifier)))
                return Result.Fail<ReviewResponse>(new Message(400, "An image to remove does not belong to this review."));

            var imageCountAfterEdit = currentImages.Count - removedIdentifiers.Count + (newImages?.Count ?? 0);

            if (imageCountAfterEdit > MaxReviewImages)
                return Result.Fail<ReviewResponse>(TooManyImages());

            if (!await UploadImagesAsync(newImages, uploadedUrls))
            {
                await DeleteImageFilesAsync(uploadedUrls, $"Rollback of a failed review upload. {logContext}");
                return Result.Fail<ReviewResponse>(new Message(500, "Something went wrong, could not update review. Try again later."));
            }

            var update = new ReviewUpdate(
                reviewResult.Value.Id,
                NormaliseText(request.TrailReview),
                request.Rating,
                removedIdentifiers,
                uploadedUrls,
                MaxReviewImages,
                DateTime.UtcNow);

            var updateResult = await _reviewRepository.UpdateReviewAsync(update, ctoken);

            if (!updateResult.IsSuccess)
            {
                await DeleteImageFilesAsync(uploadedUrls, $"Rollback of a review update that could not be saved. {logContext}");

                return Result.Fail<ReviewResponse>(updateResult.Status switch
                {
                    RepositoryResultStatus.NotFound => ReviewNotFound(),
                    RepositoryResultStatus.Conflict => TooManyImages(),
                    _ => UpdateFailed(),
                });
            }

            saved = true;

            await DeleteImageFilesAsync(updateResult.Value.RemovedImageUrls, logContext);

            return Result.Ok(_reviewResponseFactory.Create(updateResult.Value.Review));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating review {ReviewIdentifier} for User: {UserIdentifier}", reviewIdentifier, userIdentifier);

            // keep-comment: once saved, the new rows point at these files
            if (!saved && uploadedUrls.Count != 0)
                await DeleteImageFilesAsync(uploadedUrls, $"Rollback of a failed review upload. {logContext}");

            return Result.Fail<ReviewResponse>(UpdateFailed());
        }
    }

    private static string? NormaliseText(string? text)
    {
        return string.IsNullOrWhiteSpace(text) ? null : text.Trim();
    }

    private static Message ReviewNotFound()
    {
        return new Message(404, "Review not found.");
    }

    private static Message TooManyImages()
    {
        return new Message(400, $"A review can have at most {MaxReviewImages} images.");
    }

    private static Message AlreadyReviewed()
    {
        return new Message(409, "User has already reviewed this trail.");
    }

    private static Message FetchFailed()
    {
        return new Message(500, "An error occurred while fetching the review.");
    }

    private static Message AddFailed()
    {
        return new Message(500, "An error occurred while adding the review.");
    }

    private static Message UpdateFailed()
    {
        return new Message(500, "An error occurred while updating the review.");
    }

    private static Message DeleteFailed()
    {
        return new Message(500, "An error occurred while deleting the review.");
    }

    // Uploaded via the media upload service, which strips EXIF/GPS. keep-comment: privacy guarantee not visible here
    // Each stored path is added to uploadedUrls as it lands, so the caller can roll back a partial upload. keep-comment: out-parameter contract
    private async Task<bool> UploadImagesAsync(IFormFileCollection? images, List<string> uploadedUrls)
    {
        if (images == null)
            return true;

        foreach (var image in images)
        {
            var result = await _mediaUploadService.ProcessAndUploadAsync(
                image.OpenReadStream(), "reviews", ImageProcessingOptions.StripMetadataOnly);

            if (result.IsFailure || result.Value == null)
                return false;

            uploadedUrls.Add(result.Value.Path);
        }

        return true;
    }

    // Best-effort file removal: a leftover file is recoverable, so a WebDAV failure is logged
    // rather than surfaced. Used both to roll back a half-finished upload and to clean up
    // after rows that are already gone.
    //
    // A leftover file is only findable again through the log line, so the caller passes the
    // identifiers that make it traceable; the calling method's name comes along on its own.
    private async Task DeleteImageFilesAsync(
        IEnumerable<string> urls,
        string context,
        [CallerMemberName] string operation = "")
    {
        foreach (var url in urls)
        {
            try
            {
                var result = await _webDavService.DeleteFileAsync(url);

                // WebDAV answered, but refused: no exception to catch, so it is reported here
                if (result.IsFailure)
                    _logger.LogError("{Operation}: WebDAV refused to delete image {Url}. {Context}", operation, url, context);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "{Operation}: Failed to delete image {Url}. {Context}", operation, url, context);
            }
        }
    }

    public async Task<Result> DeleteReviewAsync(string reviewIdentifier, string userIdentifier, CancellationToken ctoken)
    {
        var result = await DeleteReviewCoreAsync(reviewIdentifier, userIdentifier, ctoken);

        _metrics.RecordReviewChange(MetricTags.Values.OperationRemove, MetricOutcome.From(result));

        return result;
    }

    private async Task<Result> DeleteReviewCoreAsync(string reviewIdentifier, string userIdentifier, CancellationToken ctoken)
    {
        var reviewResult = await _reviewRepository.GetReviewByIdentifierAsync(reviewIdentifier, userIdentifier, ctoken);

        if (reviewResult.Status == RepositoryResultStatus.Error)
            return Result.Fail(DeleteFailed());

        if (!reviewResult.IsSuccess)
            return Result.Fail(ReviewNotFound());

        var reviewImages = reviewResult.Value.ReviewImages?.Select(img => img.ImageUrl).ToList() ?? new List<string>();

        var result = await _reviewRepository.DeleteReviewAsync(reviewResult.Value, ctoken);

        if (!result.IsSuccess)
            return Result.Fail(DeleteFailed());

        await DeleteImageFilesAsync(reviewImages, $"ReviewIdentifier: {reviewIdentifier}, UserIdentifier: {userIdentifier}");

        return Result.Ok();
    }

    public async Task<Result<bool>> HasUserReviewedTrailAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken)
    {
        var userResult = await _userRepository.GetUserIdByIdentifierAsync(userIdentifier, ctoken);

        if (!userResult.IsSuccess)
            return Result.Fail<bool>(new Message(404, "User not found."));

        var trailResult = await _trailService.GetTrailIdByIdentifierAsync(trailIdentifier, ctoken);

        if (!trailResult.Success)
            return Result.Fail<bool>(new Message(404, "Trail not found."));

        var result = await _reviewRepository.HasUserReviewedTrailAsync(trailResult.Value, userResult.Value, ctoken);

        if (!result.IsSuccess)
            return Result.Fail<bool>(new Message(500, "An error occurred while checking for an existing review."));

        return Result.Ok(result.Value);
    }
}
