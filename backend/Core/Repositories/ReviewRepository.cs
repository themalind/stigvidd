using System.Linq.Expressions;
using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Core.Repositories;

public class ReviewRepository : IReviewRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _context;

    public ReviewRepository(IDbContextFactory<StigViddDbContext> context)
    {
        _context = context;
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
            .FirstOrDefaultAsync(r => r.Identifier == reviewIdentifier && r.User != null && r.User.Identifier == userIdentifer, ctoken);

        return review is null
            ? RepositoryResult<Review>.NotFound()
            : RepositoryResult<Review>.Success(review);
    }

    public async Task<RepositoryResult<PagedResult<T>>> GetReviewsByTrailIdentifierAsync<T>(string trailIdentifier, int page, int limit, Expression<Func<Review, T>> selector, CancellationToken ctoken)
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
}
