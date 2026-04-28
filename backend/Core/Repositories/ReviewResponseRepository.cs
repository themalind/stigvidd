using Core.Factories;
using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using WebDataContracts.ResponseModels.Review;

namespace Core.Repositories;

public class ReviewResponseRepository : IReviewResponseRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _context;
    private readonly ReviewResponseFactory _reviewResponseFactory;

    public ReviewResponseRepository(IDbContextFactory<StigViddDbContext> context, ReviewResponseFactory reviewResponseFactory)
    {
        _context = context;
        _reviewResponseFactory = reviewResponseFactory;
    }

    public async Task<RepositoryResult<Review>> AddReviewAsync(Review review, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        context.Reviews.Add(review);
        await context.SaveChangesAsync(ctoken);

        await context.Entry(review).Reference(r => r.User).LoadAsync(ctoken);
        await context.Entry(review).Reference(r => r.Trail).LoadAsync(ctoken);

        return RepositoryResult<Review>.Success(review);
    }

    public async Task<RepositoryResult> DeleteReviewAsync(Review review, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        context.Remove(review);
        await context.SaveChangesAsync(ctoken);

        return RepositoryResult.Success();
    }

    public async Task<RepositoryResult<Review>> GetReviewByIdentifierAsync(string reviewIdentifier, string userIdentifer, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var review = await context.Reviews
            .Include(r => r.ReviewImages)
            .FirstOrDefaultAsync(r => r.Identifier == reviewIdentifier && r.User!.Identifier == userIdentifer, ctoken);

        return review is null
            ? RepositoryResult<Review>.NotFound()
            : RepositoryResult<Review>.Success(review);
    }

    public async Task<RepositoryResult<PagedReviewResponse>> GetReviewsByTrailIdentifierAsync(string trailIdentifier, int page, int limit, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var offset = page * limit;

        var totalCount = await context.Reviews
            .AsNoTracking()
            .Where(r => r.Trail!.Identifier == trailIdentifier)
            .CountAsync(ctoken);

        var reviews = await context.Reviews
            .AsNoTracking()
            .Where(r => r.Trail!.Identifier == trailIdentifier)
            .Include(r => r.User)
            .Include(r => r.Trail)
            .Include(r => r.ReviewImages)
            .OrderByDescending(r => r.CreatedAt)
            .Skip(offset)
            .Take(limit + 1)
            .ToListAsync(ctoken);

        var hasMore = reviews.Count > limit;

        var reviewResponses = (hasMore ? reviews.Take(limit) : reviews)
            .Select(_reviewResponseFactory.Create)
            .ToList();

        return RepositoryResult<PagedReviewResponse>.Success(_reviewResponseFactory.Create(reviewResponses, page, hasMore, totalCount));
    }
}
