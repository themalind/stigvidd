using Core.Factories;
using Core.Interfaces;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using WebDataContracts.ResponseModels.Review;

namespace Core.Services;

public class ReviewService : IReviewService
{
    private readonly string _presentableBaseUrl;
    private readonly IDbContextFactory<StigViddDbContext> _context;
    private readonly IWebDavService _webDavService;
    private readonly ReviewResponseFactory _reviewResponseFactory;
    private readonly ILogger<ReviewService> _logger;

    public ReviewService(IDbContextFactory<StigViddDbContext> context, IWebDavService webDavService, ReviewResponseFactory reviewResponseFactory, ILogger<ReviewService> logger, IConfiguration configuration)
    {
        _presentableBaseUrl = configuration["PresentableBaseUrl"] ?? throw new InvalidOperationException("PresentableBaseUrl configuration is missing");
        _context = context;
        _webDavService = webDavService;
        _reviewResponseFactory = reviewResponseFactory;
        _logger = logger;
    }
    public async Task<Result<IReadOnlyCollection<ReviewResponse?>>> GetReviewsByTrailIdentifierAsync(string trailIdentifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var reviews = await context.Reviews
            .AsNoTracking()
            .Where(review => review.Trail!.Identifier == trailIdentifier)
                .Select(review => ReviewResponse.Create(
                review.Identifier,
                review.TrailReview,
                review.Grade,
                review.User!.NickName,
                review.CreatedAt,
                review.Trail!.Identifier,
                review.User.Identifier,
                review.ReviewImages!.Select(reviewImage => ReviewImageResponse.Create(
                    _presentableBaseUrl,
                    reviewImage.Identifier,
                    reviewImage.ImageUrl)).ToList()
            ))
            .ToListAsync(ctoken);

        if (reviews == null || !reviews.Any())
        {
            _logger.LogInformation("No reviews found for trail with identifier: {TrailIdentifier}", trailIdentifier);

            return Result.Fail<IReadOnlyCollection<ReviewResponse?>>(new Message(404, "No reviews found for trail."));
        }

        return Result.Ok<IReadOnlyCollection<ReviewResponse?>>(reviews);
    }

    public async Task<Result<ReviewResponse?>> AddReviewAsync(string userIdentifier, string trailIdentifier, string? trailReview, float grade, IFormFileCollection? imageUrls, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var uploadedUrls = new List<string>();

        try
        {
            if(grade < 1 || grade > 5)
            {
                return Result.Fail<ReviewResponse?>(new Message(400, "Grade must be between 0 and 5."));
            }

            if (imageUrls != null)
            {
                foreach (var image in imageUrls)
                {
                    var url = await _webDavService.UploadFileAsync(image.OpenReadStream(), "reviews");
                    uploadedUrls.Add(url);
                }
            }

            var user = await context.Users.FirstOrDefaultAsync(u => u.Identifier == userIdentifier, ctoken);

            if (user == null)
            {
                return Result.Fail<ReviewResponse?>(new Message(404, "User not found."));
            }

            var trail = await context.Trails.FirstOrDefaultAsync(t => t.Identifier == trailIdentifier, ctoken);

            if (trail == null)
            {
                return Result.Fail<ReviewResponse?>(new Message(404, "Trail not found."));
            }

            var review = new Review
            {
                TrailReview = trailReview,
                Grade = grade,
                TrailId = trail.Id,
                UserId = user.Id,
            };

            if (uploadedUrls.Any())
            {
                foreach (var image in uploadedUrls)
                {
                    var reviewImage = new ReviewImage
                    {
                        ImageUrl = image,
                        Review = review
                    };
                    context.ReviewImages.Add(reviewImage);
                }
            }

            context.Reviews.Add(review);
            await context.SaveChangesAsync(ctoken);

            _logger.LogInformation("Review added successfully for User: {UserId}, Trail: {TrailId}",
            user.Id, trail.Id);

            return Result.Ok(_reviewResponseFactory?.Create(review));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding review for User: {UserIdentifier}, Trail: {TrailIdentifier}",
           userIdentifier, trailIdentifier);

            if (uploadedUrls.Any())
            {
                await CleanupUploadedImagesAsync(uploadedUrls);
            }

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
        using var context = await _context.CreateDbContextAsync(ctoken);

        var review = await context.Reviews
            .Include(review => review.ReviewImages)
            .Where(review => review.Identifier == reviewIdentifier && review.User!.Identifier == userIdentifer)
            .FirstOrDefaultAsync(ctoken);

        if (review is null)
        {
            return Result.Fail(new Message(404, $"RemoveReviewAsync: Could not find review with identifier: {reviewIdentifier} and user identifier: {userIdentifer} "));
        }

        // Släng bilder från reviewn i webdaven
        if (review.ReviewImages != null && review.ReviewImages.Any())
        {
            foreach (var image in review.ReviewImages)
            {
                try
                {
                    await _webDavService.DeleteFileAsync(image.ImageUrl);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, $"RemoveReviewAsync: Failed to remove image {image.ImageUrl}. UserIdentifier: {userIdentifer}, ReviewIdentifer: {reviewIdentifier}");
                }
            }
        }

        context.Remove(review);
        await context.SaveChangesAsync(ctoken);

        return Result.Ok();
    }
}