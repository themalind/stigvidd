using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Infrastructure.Data.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using System.Runtime.CompilerServices;
using WebDataContracts.ResponseModels.Review;

namespace Core.Services;

public class ReviewService : IReviewService
{
    private readonly IReviewRepository _reviewRepository;
    private readonly IWebDavService _webDavService;
    private readonly IMediaUploadService _mediaUploadService;
    // The user lookup goes to the repository, not IUserService: UserService depends on this
    // service to clean up a deleted user's reviews, and taking IUserService here would make
    // the two services a resolve-time cycle.
    private readonly IUserRepository _userRepository;
    private readonly ITrailService _trailService;
    private readonly ReviewResponseFactory _reviewResponseFactory;
    private readonly ILogger<ReviewService> _logger;

    public ReviewService(
        IReviewRepository reviewRepository,
        IWebDavService webDavService,
        IMediaUploadService mediaUploadService,
        IUserRepository userRepository,
        ITrailService trailService,
        ReviewResponseFactory reviewResponseFactory,
        ILogger<ReviewService> logger)
    {
        _reviewRepository = reviewRepository;
        _webDavService = webDavService;
        _mediaUploadService = mediaUploadService;
        _userRepository = userRepository;
        _trailService = trailService;
        _reviewResponseFactory = reviewResponseFactory;
        _logger = logger;
    }

    public async Task<Result<PagedReviewResponse>> GetReviewsByTrailIdentifierAsync(
        string trailIdentifier,
        int page,
        int limit,
        CancellationToken ctoken)
    {
        var baseUrl = _reviewResponseFactory.PresentableBaseUrl;

        var result = await _reviewRepository.GetReviewsByTrailIdentifierAsync(
            trailIdentifier, page, limit,
            r => ReviewResponse.Create(
                r.Identifier,
                r.TrailReview,
                r.Rating,
                r.User != null ? r.User.NickName : null,
                r.CreatedAt,
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

    public async Task<Result<ReviewResponse?>> AddReviewAsync(
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
                return Result.Fail<ReviewResponse?>(new Message(400, "Rating must be between 0 and 5."));

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
                return Result.Fail<ReviewResponse?>(new Message(500, "An error occurred while adding the review."));

            if (existingResult.Value)
                return Result.Fail<ReviewResponse?>(new Message(409, "User has already reviewed this trail."));

            if (imageUrls != null)
            {
                // Uploaded via the media upload service, which strips EXIF/GPS.
                foreach (var image in imageUrls)
                {
                    var result = await _mediaUploadService.ProcessAndUploadAsync(
                        image.OpenReadStream(), "reviews", ImageProcessingOptions.StripMetadataOnly);

                    if (result.IsFailure || result.Value == null)
                    {
                        await DeleteImageFilesAsync(uploadedUrls, $"Rollback of a failed review upload. UserIdentifier: {userIdentifier}, TrailIdentifier: {trailIdentifier}");
                        return Result.Fail<ReviewResponse?>(new Message(500, "Something went wrong, could not create review. Try again later."));
                    }

                    uploadedUrls.Add(result.Value.Path);
                }
            }

            var review = new Review
            {
                TrailReview = trailReview,
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
                return Result.Fail<ReviewResponse?>(new Message(500, "An error occurred while adding the review."));
            }

            return Result.Ok<ReviewResponse?>(_reviewResponseFactory.Create(addResult.Value));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding review for User: {UserIdentifier}, Trail: {TrailIdentifier}", userIdentifier, trailIdentifier);

            if (uploadedUrls.Any())
                await DeleteImageFilesAsync(uploadedUrls, $"Rollback of a failed review upload. UserIdentifier: {userIdentifier}, TrailIdentifier: {trailIdentifier}");

            return Result.Fail<ReviewResponse?>(new Message(500, "An error occurred while adding the review."));
        }
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

    public async Task<Result> DeleteReviewAsync(string reviewIdentifier, string userIdentifer, CancellationToken ctoken)
    {
        var reviewResult = await _reviewRepository.GetReviewByIdentifierAsync(reviewIdentifier, userIdentifer, ctoken);

        if (reviewResult.Status == RepositoryResultStatus.Error)
            return Result.Fail(new Message(500, "An error occurred while deleting the review."));

        if (!reviewResult.IsSuccess)
            return Result.Fail(new Message(404, $"RemoveReviewAsync: Could not find review with identifier: {reviewIdentifier} and user identifier: {userIdentifer}"));

        var reviewImages = reviewResult.Value.ReviewImages?.Select(img => img.ImageUrl).ToList() ?? new List<string>();

        var result = await _reviewRepository.DeleteReviewAsync(reviewResult.Value, ctoken);

        if (!result.IsSuccess)
            return Result.Fail(new Message(500, "An error occurred while deleting the review."));

        await DeleteImageFilesAsync(reviewImages, $"ReviewIdentifier: {reviewIdentifier}, UserIdentifier: {userIdentifer}");

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

    public async Task<Result> AnonymizeUserReviewsOnUserDeleteAsync(int userId, CancellationToken ctoken)
    {
        // Read the URLs while the rows still point at the user; the files go last, best-effort.
        var imageUrlsResult = await _reviewRepository.GetReviewImageUrlsByUserIdAsync(userId, ctoken);

        if (!imageUrlsResult.IsSuccess)
            return Result.Fail(new Message(500, "An error occurred while fetching the review image URLs."));

        var result = await _reviewRepository.AnonymizeReviewsByUserIdAsync(userId, ctoken);

        if (!result.IsSuccess)
            return Result.Fail(new Message(500, "An error occurred while anonymizing the user's reviews."));

        await DeleteImageFilesAsync(imageUrlsResult.Value, $"Account deletion. UserId: {userId}");

        return Result.Ok();
    }
}
