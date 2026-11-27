// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Linq.Expressions;
using Core.Interfaces.Repositories;
using Core.Interfaces.Repositories.Trails.Models;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Repositories.Trails;

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
        catch (DbUpdateException ex) when (UniqueViolation.On(ex, "IX_Reviews_TrailId_UserId"))
        {
            return RepositoryResult<Review>.Conflict();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ReviewRepository: AddReviewAsync -> Something went wrong when adding review.");
            return RepositoryResult<Review>.Error();
        }
    }

    // What ReviewResponseFactory.Create reads besides the review itself. keep-comment: why these three
    private static IQueryable<Review> WithResponseDetails(IQueryable<Review> reviews)
    {
        return reviews
            .Include(r => r.ReviewImages)
            .Include(r => r.User)
            .Include(r => r.Trail);
    }

    public async Task<RepositoryResult<bool>> HasUserReviewedTrailAsync(int trailId, int userId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            // Past the moderation filter: a hidden review must still count, or its author could just write a new one. keep-comment: why the filter is bypassed
            var exists = await context.Reviews
                .IgnoreQueryFilters(["Moderation"])
                .AnyAsync(r => r.TrailId == trailId && r.UserId == userId, ctoken);

            return RepositoryResult<bool>.Success(exists);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ReviewRepository: HasUserReviewedTrailAsync -> Something went wrong when checking for an existing review on trail {trailId} for user {userId}.", trailId, userId);
            return RepositoryResult<bool>.Error();
        }
    }

    public async Task<RepositoryResult<UpdatedReview>> UpdateReviewAsync(ReviewUpdate update, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);
            await using var transaction = await context.Database.BeginTransactionAsync(ctoken);

            await LockReviewAsync(context, update.ReviewId, ctoken);

            var review = await WithResponseDetails(context.Reviews)
                .FirstOrDefaultAsync(r => r.Id == update.ReviewId, ctoken);

            if (review is null)
                return RepositoryResult<UpdatedReview>.NotFound();

            var currentImages = review.ReviewImages ?? [];
            var removedImages = currentImages
                .Where(image => update.RemovedImageIdentifiers.Contains(image.Identifier))
                .ToList();

            if (currentImages.Count - removedImages.Count + update.AddedImageUrls.Count > update.MaxImages)
                return RepositoryResult<UpdatedReview>.Conflict();

            context.ReviewImages.RemoveRange(removedImages);

            foreach (var url in update.AddedImageUrls)
            {
                context.ReviewImages.Add(new ReviewImage { ImageUrl = url, Review = review });
            }

            var changed = removedImages.Count > 0
                || update.AddedImageUrls.Count > 0
                || review.TrailReview != update.TrailReview
                || review.Rating != update.Rating;

            review.TrailReview = update.TrailReview;
            review.Rating = update.Rating;

            if (changed)
                review.LastUpdatedAt = update.UpdatedAt;

            await context.SaveChangesAsync(ctoken);
            await transaction.CommitAsync(ctoken);

            return RepositoryResult<UpdatedReview>.Success(
                new UpdatedReview(review, removedImages.Select(image => image.ImageUrl).ToList()));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ReviewRepository: UpdateReviewAsync -> Something went wrong when updating review {ReviewId}.", update.ReviewId);
            return RepositoryResult<UpdatedReview>.Error();
        }
    }

    // A no-op update takes the row lock, so two edits of one review count its images one after the other. keep-comment: no suite has row locks (docs/notes/raw-sql-needs-a-postgres-check-the-sqlite-tests-cannot-give.md)
    private static async Task LockReviewAsync(StigViddDbContext context, int reviewId, CancellationToken ctoken)
    {
        if (!context.Database.IsRelational())
            return;

        await context.Reviews
            .Where(r => r.Id == reviewId)
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.Rating, r => r.Rating), ctoken);
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

    public async Task<RepositoryResult<Review>> GetReviewByIdentifierAsync(string reviewIdentifier, string userIdentifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var review = await context.Reviews
                .Include(r => r.ReviewImages)
                .FirstOrDefaultAsync(r => r.Identifier == reviewIdentifier && r.User != null && r.User.Identifier == userIdentifier, ctoken);

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

    public async Task<RepositoryResult<Review>> GetReviewByTrailAndUserAsync(string trailIdentifier, string userIdentifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var review = await WithResponseDetails(context.Reviews.AsNoTracking())
                .FirstOrDefaultAsync(r =>
                    r.Trail != null && r.Trail.Identifier == trailIdentifier &&
                    r.User != null && r.User.Identifier == userIdentifier, ctoken);

            return review is null
                ? RepositoryResult<Review>.NotFound()
                : RepositoryResult<Review>.Success(review);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ReviewRepository: GetReviewByTrailAndUserAsync -> Something went wrong when fetching the review of user {UserIdentifier} on trail {TrailIdentifier}.", userIdentifier, trailIdentifier);
            return RepositoryResult<Review>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyCollection<T>>> GetReviewsByUserIdAsync<T>(int userId, Expression<Func<Review, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var reviews = await context.Reviews
                .AsNoTracking()
                .Where(r => r.UserId == userId && r.Trail != null && r.Trail.IsVerified)
                .OrderByDescending(r => r.CreatedAt)
                .Select(selector)
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<T>>.Success(reviews);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ReviewRepository: GetReviewsByUserIdAsync -> Something went wrong when fetching reviews by user {userId}.", userId);
            return RepositoryResult<IReadOnlyCollection<T>>.Error();
        }
    }

    public async Task<RepositoryResult<PagedResult<T>>> GetReviewsByTrailIdentifierAsync<T>(string trailIdentifier, int page, int limit, int[] hiddenUserIds, Expression<Func<Review, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var offset = page * limit;

            var totalCount = await context.Reviews
                .AsNoTracking()
                .Where(r => r.Trail != null && r.Trail.Identifier == trailIdentifier)
                .Where(r => r.UserId == null || !hiddenUserIds.Contains(r.UserId.Value))
                .CountAsync(ctoken);

            var items = await context.Reviews
                .AsNoTracking()
                .Where(r => r.Trail != null && r.Trail.Identifier == trailIdentifier)
                .Where(r => r.UserId == null || !hiddenUserIds.Contains(r.UserId.Value))
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
