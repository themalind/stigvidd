using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Infrastructure.Data.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using WebDataContracts.ResponseModels.Review;

namespace Core.Services;

public class ReviewService : IReviewService
{
    private readonly IReviewRepository _reviewRepository;
    private readonly IWebDavService _webDavService;
    private readonly IUserService _userService;
    private readonly ITrailService _trailService;
    private readonly ReviewResponseFactory _reviewResponseFactory;
    private readonly ILogger<ReviewService> _logger;

    public ReviewService(
        IReviewRepository reviewRepository,
        IWebDavService webDavService,
        IUserService userService,
        ITrailService trailService,
        ReviewResponseFactory reviewResponseFactory,
        ILogger<ReviewService> logger)
    {
        _reviewRepository = reviewRepository;
        _webDavService = webDavService;
        _userService = userService;
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
                r.User != null ? r.User.NickName : string.Empty,
                r.CreatedAt,
                r.Trail != null ? r.Trail.Identifier : string.Empty,
                r.User != null ? r.User.Identifier : string.Empty,
                r.ReviewImages!.Select(img => new ReviewImageResponse
                {
                    Identifier = img.Identifier,
                    ImageUrl = baseUrl + img.ImageUrl
                }).ToList()),
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

            if (imageUrls != null)
            {
                foreach (var image in imageUrls)
                {
                    var result = await _webDavService.UploadFileAsync(image.OpenReadStream(), "reviews");

                    if (result.IsFailure)
                        return Result.Fail<ReviewResponse?>(new Message(500, "Something went wrong, could not create review. Try again later."));

                    if (result.Value != null)
                        uploadedUrls.Add(result.Value);
                }
            }

            var userResult = await _userService.GetUserIdByIdentifierAsync(userIdentifier, ctoken);

            if (!userResult.Success)
                return Result.Fail<ReviewResponse?>(new Message(404, "User not found."));

            var trailResult = await _trailService.GetTrailIdByIdentifierAsync(trailIdentifier, ctoken);

            if (!trailResult.Success)
                return Result.Fail<ReviewResponse?>(new Message(404, "Trail not found."));

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
                return Result.Fail<ReviewResponse?>(new Message(500, "An error occurred while adding the review."));

            return Result.Ok<ReviewResponse?>(_reviewResponseFactory.Create(addResult.Value));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding review for User: {UserIdentifier}, Trail: {TrailIdentifier}", userIdentifier, trailIdentifier);

            if (uploadedUrls.Any())
                await CleanupUploadedImagesAsync(uploadedUrls);

            return Result.Fail<ReviewResponse?>(new Message(500, "An error occurred while adding the review."));
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

    public async Task<Result> DeleteReviewAsync(string reviewIdentifier, string userIdentifer, CancellationToken ctoken)
    {
        var reviewResult = await _reviewRepository.GetReviewByIdentifierAsync(reviewIdentifier, userIdentifer, ctoken);

        if (reviewResult.Status == RepositoryResultStatus.Error)
            return Result.Fail(new Message(500, "An error occurred while deleting the review."));

        if (!reviewResult.IsSuccess)
            return Result.Fail(new Message(404, $"RemoveReviewAsync: Could not find review with identifier: {reviewIdentifier} and user identifier: {userIdentifer}"));

        var review = reviewResult.Value;

        if (review.ReviewImages != null && review.ReviewImages.Any())
        {
            foreach (var image in review.ReviewImages)
            {
                try
                {
                    var result = await _webDavService.DeleteFileAsync(image.ImageUrl);

                    if (result.IsFailure)
                        return Result.Fail(new Message(500, "Could not remove file. Try again later."));
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "RemoveReviewAsync: Failed to remove image {ImageUrl}. UserIdentifier: {userIdentifer}, ReviewIdentifer: {reviewIdentifier}", image.ImageUrl, userIdentifer, reviewIdentifier);
                }
            }
        }

        await _reviewRepository.DeleteReviewAsync(review, ctoken);

        return Result.Ok();
    }
}
