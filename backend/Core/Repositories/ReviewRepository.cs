using System.Linq.Expressions;
using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Repositories;

public class ReviewRepository : IReviewRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _context;
    private readonly ILogger<ReviewRepository> _logger;

    public ReviewRepository(IDbContextFactory<StigViddDbContext> context, ILogger<ReviewRepository> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<RepositoryResult<Review>> AddReviewAsync(Review review, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            context.Reviews.Add(review);
            await context.SaveChangesAsync(ctoken);

            await context.Entry(review).Reference(r => r.User).LoadAsync(ctoken);
            await context.Entry(review).Reference(r => r.Trail).LoadAsync(ctoken);

            return RepositoryResult<Review>.Success(review);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ReviewRepository: AddReviewAsync -> Something went wrong when adding review.");
            return RepositoryResult<Review>.Error();
        }
    }

    public async Task<RepositoryResult<bool>> HasUserReviewedTrailAsync(int trailId, int userId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var exists = await context.Reviews.AnyAsync(r => r.TrailId == trailId && r.UserId == userId, ctoken);

            return RepositoryResult<bool>.Success(exists);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ReviewRepository: HasUserReviewedTrailAsync -> Something went wrong when checking for an existing review on trail {trailId} for user {userId}.", trailId, userId);
            return RepositoryResult<bool>.Error();
        }
    }

    // Shared so the collected image URLs match the rows that change.
    private static IQueryable<Review> UserReviews(StigViddDbContext context, int userId) =>
        context.Reviews.Where(r => r.UserId == userId);

    public async Task<RepositoryResult<IEnumerable<string>>> GetReviewImageUrlsByUserIdAsync(int userId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var userReviewIds = UserReviews(context, userId).Select(r => r.Id);

            var imageUrls = await context.ReviewImages
                .Where(ri => userReviewIds.Contains(ri.ReviewId))
                .Select(ri => ri.ImageUrl)
                .ToListAsync(ctoken);

            return RepositoryResult<IEnumerable<string>>.Success(imageUrls);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ReviewRepository: GetReviewImageUrlsByUserIdAsync -> Something went wrong when fetching review image URLs for user with ID {userId}.", userId);
            return RepositoryResult<IEnumerable<string>>.Error();
        }
    }

    // Clears the text and deletes the images on the user's reviews, keeping the rating.
    // UserId is nulled by SetNull when the user row goes.
    public async Task<RepositoryResult> AnonymizeReviewsByUserIdAsync(int userId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var reviews = await UserReviews(context, userId)
                .Include(r => r.ReviewImages)
                .ToListAsync(ctoken);

            foreach (var review in reviews)
                review.TrailReview = null;

            context.ReviewImages.RemoveRange(reviews.SelectMany(r => r.ReviewImages ?? []));

            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ReviewRepository: AnonymizeReviewsByUserIdAsync -> Something went wrong when anonymizing reviews for user with ID {userId}.", userId);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult> DeleteReviewAsync(Review review, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            context.Remove(review);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ReviewRepository: DeleteReviewAsync -> Something went wrong when deleting review with identifier {identifier}.", review.Identifier);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult<Review>> GetReviewByIdentifierAsync(string reviewIdentifier, string userIdentifer, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var review = await context.Reviews
                .Include(r => r.ReviewImages)
                .FirstOrDefaultAsync(r => r.Identifier == reviewIdentifier && r.User != null && r.User.Identifier == userIdentifer, ctoken);

            return review is null
                ? RepositoryResult<Review>.NotFound()
                : RepositoryResult<Review>.Success(review);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ReviewRepository: GetReviewByIdentifierAsync -> Something went wrong when fetching review with identifier {reviewIdentifier}.", reviewIdentifier);
            return RepositoryResult<Review>.Error();
        }
    }

    public async Task<RepositoryResult<PagedResult<T>>> GetReviewsByTrailIdentifierAsync<T>(string trailIdentifier, int page, int limit, Expression<Func<Review, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var offset = page * limit;

            var totalCount = await context.Reviews
                .AsNoTracking()
                .Where(r => r.Trail != null && r.Trail.Identifier == trailIdentifier)
                .CountAsync(ctoken);

            var items = await context.Reviews
                .AsNoTracking()
                .Where(r => r.Trail != null && r.Trail.Identifier == trailIdentifier)
                .OrderByDescending(r => r.CreatedAt)
                .Skip(offset)
                .Take(limit + 1)
                .Select(selector)
                .ToListAsync(ctoken);

            var hasMore = items.Count > limit;

            return RepositoryResult<PagedResult<T>>.Success(
                new PagedResult<T>(
                    hasMore ? items.Take(limit).ToList() : items,
                    page,
                    hasMore,
                    totalCount));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ReviewRepository: GetReviewsByTrailIdentifierAsync -> Something went wrong when fetching reviews for trail with identifier {trailIdentifier}.", trailIdentifier);
            return RepositoryResult<PagedResult<T>>.Error();
        }
    }
}
