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
    public async Task<Result<PagedReviewResponse>> GetReviewsByTrailIdentifierAsync(string trailIdentifier, int page, int limit, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var offset = page * limit;

        // För att få veta hur många reviews det finns totalt
        var totalCount = await context.Reviews
            .AsNoTracking()
            .Where(review => review.Trail!.Identifier == trailIdentifier)
            .CountAsync(ctoken);

        var reviews = await context.Reviews
            .AsNoTracking()
            .Where(review => review.Trail!.Identifier == trailIdentifier)
            .OrderByDescending(review => review.CreatedAt)
            .Skip(offset)
            .Take(limit + 1)
            .Select(review => ReviewResponse.Create(
                review.Identifier,
                review.TrailReview,
                review.Rating,
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

        var hasMore = reviews.Count > limit;

        var result = hasMore ? reviews.Take(limit).ToList() : reviews; // Finns det fler recensioner? Om ja ta bara så många som limit är satt till, annars behålla alla. 
        var pagedReviewResponse = _reviewResponseFactory.Create(result, page, hasMore, totalCount);

        return Result.Ok(pagedReviewResponse);
    }

    public async Task<Result<ReviewResponse?>> AddReviewAsync(string userIdentifier, string trailIdentifier, string? trailReview, decimal rating, IFormFileCollection? imageUrls, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var uploadedUrls = new List<string>();

        try
        {
            if (rating < 1M || rating > 5M)
            {
                return Result.Fail<ReviewResponse?>(new Message(400, "Rating must be between 0 and 5."));
            }

            if (imageUrls != null)
            {
                foreach (var image in imageUrls)
                {
                    var result = await _webDavService.UploadFileAsync(image.OpenReadStream(), "reviews");

                    if (result.IsFailure)
                    {
                        return Result.Fail<ReviewResponse?>(new Message(500, "Something went wrong, could not create review. Try again later."));
                    }
                    if(result.Value != null)
                    {
                        uploadedUrls.Add(result.Value);
                    }                   
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
                Rating = rating,
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
                   var result = await _webDavService.DeleteFileAsync(image.ImageUrl);

                    if (result.IsFailure)
                    {
                        return Result.Fail(new Message(500, "Could not remove file. Try again later."));
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "RemoveReviewAsync: Failed to remove image {image.ImageUrl}. UserIdentifier: {userIdentifer}, ReviewIdentifer: {reviewIdentifier}", image.ImageUrl, userIdentifer, reviewIdentifier);
                }
            }
        }

        context.Remove(review);
        await context.SaveChangesAsync(ctoken);

        return Result.Ok();
    }
}