// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Configurations;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Geometries;
using System.Linq.Expressions;

namespace Core.Repositories;

public class HikeSubmissionRepository : IHikeSubmissionRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _context;
    private readonly ILogger<HikeSubmissionRepository> _logger;

    public HikeSubmissionRepository(IDbContextFactory<StigViddDbContext> context, ILogger<HikeSubmissionRepository> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<RepositoryResult<HikeSubmission>> AddAsync(HikeSubmission submission, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            context.HikeSubmissions.Add(submission);

            try
            {
                await context.SaveChangesAsync(ctoken);
            }
            catch (DbUpdateException) when (submission.SourceHikeId is not null)
            {
                if (await HasPendingAsync(submission.SourceHikeId, ctoken))
                    return RepositoryResult<HikeSubmission>.Conflict();

                throw;
            }

            return RepositoryResult<HikeSubmission>.Success(submission);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeSubmissionRepository: AddAsync -> Something went wrong when adding a submission.");
            return RepositoryResult<HikeSubmission>.Error();
        }
    }

    public async Task<RepositoryResult<bool>> HasPendingForHikeAsync(int hikeId, CancellationToken ctoken)
    {
        try
        {
            return RepositoryResult<bool>.Success(await HasPendingAsync(hikeId, ctoken));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeSubmissionRepository: HasPendingForHikeAsync -> Something went wrong for hike {HikeId}.", hikeId);
            return RepositoryResult<bool>.Error();
        }
    }

    private async Task<bool> HasPendingAsync(int? hikeId, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        return await context.HikeSubmissions
            .AnyAsync(s => s.SourceHikeId == hikeId && s.Status == HikeSubmissionStatus.Pending, ctoken);
    }

    public async Task<RepositoryResult<int>> GetConsentTextIdAsync(string version, string locale, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var id = await context.ConsentTexts
                .Where(c => c.Kind == ConsentTextConfiguration.HikeTransfer && c.Version == version && c.Locale == locale)
                .Select(c => (int?)c.Id)
                .FirstOrDefaultAsync(ctoken);

            return id is int found ? RepositoryResult<int>.Success(found) : RepositoryResult<int>.NotFound();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeSubmissionRepository: GetConsentTextIdAsync -> Something went wrong for version {Version} ({Locale}).", version, locale);
            return RepositoryResult<int>.Error();
        }
    }

    public async Task<RepositoryResult<T>> GetByIdentifierAsync<T>(string identifier, Expression<Func<HikeSubmission, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var result = await context.HikeSubmissions.AsNoTracking()
                .Where(s => s.Identifier == identifier)
                .Select(selector)
                .FirstOrDefaultAsync(ctoken);

            return result is null
                ? RepositoryResult<T>.NotFound()
                : RepositoryResult<T>.Success(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeSubmissionRepository: GetByIdentifierAsync -> Something went wrong for submission {Identifier}.", identifier);
            return RepositoryResult<T>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyCollection<T>>> GetByUserIdAsync<T>(int userId, Expression<Func<HikeSubmission, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var result = await context.HikeSubmissions.AsNoTracking()
                .Where(s => s.UserId == userId)
                .OrderByDescending(s => s.CreatedAt)
                .Select(selector)
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<T>>.Success(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeSubmissionRepository: GetByUserIdAsync -> Something went wrong for user {UserId}.", userId);
            return RepositoryResult<IReadOnlyCollection<T>>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyCollection<T>>> GetByStatusAsync<T>(HikeSubmissionStatus? status, Expression<Func<HikeSubmission, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var query = context.HikeSubmissions.AsNoTracking();

            if (status.HasValue)
                query = query.Where(s => s.Status == status.Value);

            var result = await query
                .OrderByDescending(s => s.CreatedAt)
                .Select(selector)
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<T>>.Success(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeSubmissionRepository: GetByStatusAsync -> Something went wrong when listing submissions.");
            return RepositoryResult<IReadOnlyCollection<T>>.Error();
        }
    }

    public async Task<RepositoryResult> UpdateDetailsAsync(
        string identifier, string name, string description, int classification,
        string parking, string gettingThere, string publicTransport, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var submission = await context.HikeSubmissions.FirstOrDefaultAsync(s => s.Identifier == identifier, ctoken);

            if (submission is null)
                return RepositoryResult.NotFound();

            if (submission.Status != HikeSubmissionStatus.Pending)
                return RepositoryResult.Conflict();

            submission.Name = name;
            submission.Description = description;
            submission.Classification = classification;
            submission.Parking = parking;
            submission.GettingThere = gettingThere;
            submission.PublicTransport = publicTransport;
            submission.LastUpdatedAt = DateTime.UtcNow;

            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (DbUpdateConcurrencyException)
        {
            return RepositoryResult.Conflict();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeSubmissionRepository: UpdateDetailsAsync -> Something went wrong for submission {Identifier}.", identifier);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult> UpdateGeometryAsync(string identifier, LineString path, decimal lengthKm, double longestGapMetres, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var submission = await context.HikeSubmissions.FirstOrDefaultAsync(s => s.Identifier == identifier, ctoken);

            if (submission is null)
                return RepositoryResult.NotFound();

            if (submission.Status != HikeSubmissionStatus.Pending)
                return RepositoryResult.Conflict();

            submission.GeoPath = path;
            submission.TrailLength = lengthKm;
            submission.LongestGapMetres = longestGapMetres;
            submission.LastUpdatedAt = DateTime.UtcNow;

            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (DbUpdateConcurrencyException)
        {
            return RepositoryResult.Conflict();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeSubmissionRepository: UpdateGeometryAsync -> Something went wrong for submission {Identifier}.", identifier);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult<string>> DeleteImageAsync(string identifier, string imageIdentifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var image = await context.HikeSubmissionImages
                .Where(i => i.Identifier == imageIdentifier && i.HikeSubmission != null && i.HikeSubmission.Identifier == identifier)
                .FirstOrDefaultAsync(ctoken);

            if (image is null)
                return RepositoryResult<string>.NotFound();

            context.HikeSubmissionImages.Remove(image);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<string>.Success(image.ImageUrl);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeSubmissionRepository: DeleteImageAsync -> Something went wrong for image {ImageIdentifier}.", imageIdentifier);
            return RepositoryResult<string>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyCollection<string>>> RejectAsync(string identifier, string reason, string decidedBy, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var submission = await context.HikeSubmissions
                .Include(s => s.Images)
                .FirstOrDefaultAsync(s => s.Identifier == identifier, ctoken);

            if (submission is null)
                return RepositoryResult<IReadOnlyCollection<string>>.NotFound();

            if (submission.Status != HikeSubmissionStatus.Pending)
                return RepositoryResult<IReadOnlyCollection<string>>.Conflict();

            var urls = submission.Images.Select(i => i.ImageUrl).ToList();

            context.HikeSubmissionImages.RemoveRange(submission.Images);
            ClearContent(submission);
            submission.Status = HikeSubmissionStatus.Rejected;
            submission.RejectionReason = reason;
            submission.DecidedBy = decidedBy;
            submission.DecidedAt = DateTime.UtcNow;
            submission.LastUpdatedAt = DateTime.UtcNow;

            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<string>>.Success(urls);
        }
        catch (DbUpdateConcurrencyException)
        {
            return RepositoryResult<IReadOnlyCollection<string>>.Conflict();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeSubmissionRepository: RejectAsync -> Something went wrong for submission {Identifier}.", identifier);
            return RepositoryResult<IReadOnlyCollection<string>>.Error();
        }
    }

    // keep-comment: the name stays so the submitter can see which walk the rejection reason is about
    private static void ClearContent(HikeSubmission submission)
    {
        submission.GeoPath = null;
        submission.OriginalGeoPath = null;
        submission.Description = string.Empty;
        submission.Parking = string.Empty;
        submission.GettingThere = string.Empty;
        submission.PublicTransport = string.Empty;
        submission.LongestGapMetres = 0;
    }

    public async Task<RepositoryResult<ApprovedSubmission>> ApproveAsync(string identifier, string decidedBy, IReadOnlyCollection<string> placeholderImagePaths, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var submission = await context.HikeSubmissions
                .Include(s => s.Images)
                .ThenInclude(i => i.SourceHikeImage)
                .FirstOrDefaultAsync(s => s.Identifier == identifier, ctoken);

            if (submission is null)
                return RepositoryResult<ApprovedSubmission>.NotFound();

            if (submission.Status != HikeSubmissionStatus.Pending)
                return RepositoryResult<ApprovedSubmission>.Conflict();

            var publishable = submission.Images.Where(IsPublishable).ToList();
            var discarded = submission.Images.Except(publishable).Select(i => i.ImageUrl).ToList();

            var images = publishable.Count != 0
                ? publishable
                    .OrderBy(i => i.SortOrder)
                    .Select(i => new TrailImage
                    {
                        ImageUrl = i.ImageUrl,
                        Width = i.Width,
                        Height = i.Height,
                        SizeBytes = i.SizeBytes,
                        SortOrder = i.SortOrder,
                    })
                    .ToList()
                : placeholderImagePaths
                    .Select((path, index) => new TrailImage { ImageUrl = path, SortOrder = index })
                    .ToList();

            var trail = new Trail
            {
                Name = submission.Name,
                TrailLength = submission.TrailLength,
                Classification = submission.Classification,
                Description = submission.Description,
                GeoPath = submission.GeoPath,
                CreatedBy = decidedBy,
                IsVerified = true,
                VisitorInformation = new VisitorInformation
                {
                    Parking = submission.Parking,
                    GettingThere = submission.GettingThere,
                    PublicTransport = submission.PublicTransport,
                },
                TrailImages = images,
                Contribution = new TrailContribution
                {
                    SubmittedByUserId = submission.UserId,
                    ShowSubmitterName = submission.ShowSubmitterName,
                    PublishedAt = DateTime.UtcNow,
                    TransferAcceptedAt = submission.TransferAcceptedAt,
                    ConsentTextId = submission.ConsentTextId,
                },
            };

            // keep-comment: the files now belong to the trail's images, so the submission's rows go without their files
            context.HikeSubmissionImages.RemoveRange(submission.Images);
            context.Trails.Add(trail);

            submission.Status = HikeSubmissionStatus.Approved;
            submission.DecidedBy = decidedBy;
            submission.DecidedAt = DateTime.UtcNow;
            submission.LastUpdatedAt = DateTime.UtcNow;
            submission.PublishedTrail = trail;

            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<ApprovedSubmission>.Success(new ApprovedSubmission(trail.Identifier, discarded));
        }
        catch (DbUpdateConcurrencyException)
        {
            return RepositoryResult<ApprovedSubmission>.Conflict();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeSubmissionRepository: ApproveAsync -> Something went wrong for submission {Identifier}.", identifier);
            return RepositoryResult<ApprovedSubmission>.Error();
        }
    }

    // keep-comment: a copy whose hike photo was deleted stays; one whose hike photo was hidden by moderation does not
    public static readonly Expression<Func<HikeSubmissionImage, bool>> IsPublishableExpression =
        i => i.SourceHikeImage == null || i.SourceHikeImage.ModerationState == ModerationState.Visible;

    private static readonly Func<HikeSubmissionImage, bool> IsPublishable = IsPublishableExpression.Compile();

    public async Task<RepositoryResult<IReadOnlyCollection<string>>> WithdrawAsync(string identifier, int userId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var submission = await context.HikeSubmissions
                .Include(s => s.Images)
                .FirstOrDefaultAsync(s => s.Identifier == identifier && s.UserId == userId, ctoken);

            if (submission is null)
                return RepositoryResult<IReadOnlyCollection<string>>.NotFound();

            if (submission.Status == HikeSubmissionStatus.Approved)
                return RepositoryResult<IReadOnlyCollection<string>>.Conflict();

            var urls = submission.Images.Select(i => i.ImageUrl).ToList();

            context.HikeSubmissions.Remove(submission);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<string>>.Success(urls);
        }
        catch (DbUpdateConcurrencyException)
        {
            return RepositoryResult<IReadOnlyCollection<string>>.Conflict();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeSubmissionRepository: WithdrawAsync -> Something went wrong for submission {Identifier}.", identifier);
            return RepositoryResult<IReadOnlyCollection<string>>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyCollection<string>>> DeleteByUserIdAsync(int userId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var submissions = await context.HikeSubmissions
                .Include(s => s.Images)
                .Where(s => s.UserId == userId)
                .ToListAsync(ctoken);

            var urls = submissions.SelectMany(s => s.Images).Select(i => i.ImageUrl).ToList();

            context.HikeSubmissions.RemoveRange(submissions);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<string>>.Success(urls);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeSubmissionRepository: DeleteByUserIdAsync -> Something went wrong for user {UserId}.", userId);
            return RepositoryResult<IReadOnlyCollection<string>>.Error();
        }
    }
}
