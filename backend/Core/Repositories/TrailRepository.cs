// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Geometries;
using System.Linq.Expressions;

namespace Core.Repositories;

public class TrailRepository : ITrailRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _context;
    private readonly ILogger<TrailRepository> _logger;

    // The proximity term's ceiling, in the same units as the average rating it is added to,
    // so a trail on the doorstep can outrank a better-reviewed one further off.
    private const double ProximityBoostPoints = 5.0;

    // Distance at which that boost halves. 5 km is a walk-today radius, and small enough that
    // trails two municipalities away do not all score alike — which is what the previous
    // 10-DEGREE scale (about 1 100 km) did, making the term a constant and the ranking
    // rating-only in everything but appearance.
    private const double ProximityHalfBoostMetres = 5_000.0;

    public TrailRepository(IDbContextFactory<StigViddDbContext> context, ILogger<TrailRepository> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<RepositoryResult<IReadOnlyCollection<T>>> GetAllTrailsWithBasicInfoAsync<T>(
        Expression<Func<Trail, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var trails = await context.Trails.AsNoTracking()
                .Where(t => t.IsVerified && t.GeoPath != null)
                .Select(selector)
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<T>>.Success(trails);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailRepository: GetAllTrailsWithBasicInfoAsync -> Something went wrong when fetching trails.");
            return RepositoryResult<IReadOnlyCollection<T>>.Error();
        }
    }

    public async Task<RepositoryResult<string>> GetCoordinatesByTrailIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var match = await context.Trails
                .AsNoTracking()
                .Where(t => t.Identifier == identifier && t.IsVerified == true)
                .Select(t => new { t.GeoPath })
                .FirstOrDefaultAsync(ctoken);

            return match is null
                ? RepositoryResult<string>.NotFound()
                : RepositoryResult<string>.Success(GeoPathSerializer.ToCoordinateJson(match.GeoPath));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailRepository: GetCoordinatesByTrailIdentifierAsync -> Something went wrong when fetching coordinates for trail with identifier {identifier}.", identifier);
            return RepositoryResult<string>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyList<double[]>>> GetTrailPathForAdminAsync(string identifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var match = await context.Trails
                .AsNoTracking()
                .Where(t => t.Identifier == identifier)
                .Select(t => new { t.GeoPath })
                .FirstOrDefaultAsync(ctoken);

            if (match is null)
                return RepositoryResult<IReadOnlyList<double[]>>.NotFound();

            return RepositoryResult<IReadOnlyList<double[]>>.Success(
                match.GeoPath is null ? [] : GeoPathSerializer.ToCoordinatePairs(match.GeoPath));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailRepository: GetTrailPathForAdminAsync -> Something went wrong when fetching the path for trail with identifier {identifier}.", identifier);
            return RepositoryResult<IReadOnlyList<double[]>>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyCollection<T>>> GetPopularTrailOverviewsAsync<T>(
        double? userLatitude, double? userLongitude, Expression<Func<Trail, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            // A trail with no path has no start point to rank by, so it is ineligible either
            // way — consistent with the markers and basic-info queries.
            var eligibleTrails = context.Trails.AsNoTracking()
                .Where(t => t.IsVerified && t.GeoPath != null && t.Contribution == null);

            // Score = average rating, boosted by proximity when the user's location is known.
            // Ordering/scoring is a data concern and stays here; the projection shape comes
            // from the caller's selector so the repository never builds a response model.
            //
            // The two cases are separate queries on purpose. Folding them into one with a
            // `hasLocation ? ... : 0.0` term reads tidier but ships the whole geometry
            // expression to the server on the no-location path as well — EF parameterises the
            // captured bool rather than folding it, so ST_StartPoint/ST_X/ST_Y/sqrt would run
            // over every candidate row to be multiplied by nothing.
            IQueryable<Trail> rankedTrails;

            if (userLatitude.HasValue && userLongitude.HasValue)
            {
                // Distance has to come out in METRES, and ST_Distance on a geometry column gives
                // degrees — which is not a unit you can pick a threshold in, because a degree of
                // longitude at 57.7 N is barely half a degree of latitude. So scale each axis by
                // its own metres-per-degree at the user, which is exactly what LocalMetricProjection
                // already works out. Equirectangular, and well under a percent over a region: this
                // is a relevance weight, not a measurement.
                //
                // Deliberately NOT ST_DistanceSphere or a ::geography cast. Those are Npgsql-only,
                // and this query has to translate on three providers — Npgsql in production,
                // SpatiaLite in the integration suite, and in-process NTS under EF InMemory in the
                // unit tests. ST_X/ST_Y/ST_StartPoint plus arithmetic translate on all three.
                var originLongitude = userLongitude.Value;
                var originLatitude = userLatitude.Value;
                var projection = LocalMetricProjection.CentredOn(new Coordinate(originLongitude, originLatitude));
                var metresPerDegreeLongitude = projection.MetresPerDegreeLongitude;
                var metresPerDegreeLatitude = projection.MetresPerDegreeLatitude;

                rankedTrails =
                    from t in eligibleTrails
                    let eastingMetres = (t.GeoPath!.StartPoint.X - originLongitude) * metresPerDegreeLongitude
                    let northingMetres = (t.GeoPath!.StartPoint.Y - originLatitude) * metresPerDegreeLatitude
                    let metresAway = Math.Sqrt((eastingMetres * eastingMetres) + (northingMetres * northingMetres))
                    let score = (double)(t.Reviews!.Any() ? t.Reviews!.Average(r => r.Rating) : 0m)
                        + (ProximityBoostPoints / (1.0 + (metresAway / ProximityHalfBoostMetres)))
                    orderby score descending
                    select t;
            }
            else
            {
                rankedTrails =
                    from t in eligibleTrails
                    let rating = t.Reviews!.Any() ? t.Reviews!.Average(r => r.Rating) : 0m
                    orderby rating descending
                    select t;
            }

            var result = await rankedTrails.Take(10).Select(selector).ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<T>>.Success(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailRepository: GetPopularTrailOverviewsAsync -> Something went wrong when fetching popular trail overviews.");
            return RepositoryResult<IReadOnlyCollection<T>>.Error();
        }
    }

    public async Task<RepositoryResult<T>> GetTrailByIdentifierAsync<T>(string identifier, Expression<Func<Trail, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var result = await context.Trails
                .AsNoTracking()
                .Where(t => t.Identifier == identifier && t.IsVerified == true)
                .Select(selector)
                .FirstOrDefaultAsync(ctoken);

            return result is null
                ? RepositoryResult<T>.NotFound()
                : RepositoryResult<T>.Success(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailRepository: GetTrailByIdentifierAsync -> Something went wrong when fetching trail with identifier {identifier}.", identifier);
            return RepositoryResult<T>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyCollection<T>>> GetTrailsByIdentifiersAsync<T>(
        IReadOnlyCollection<string> identifiers, Expression<Func<Trail, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var results = await context.Trails
                .AsNoTracking()
                .Where(t => t.IsVerified && identifiers.Contains(t.Identifier))
                .Select(selector)
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<T>>.Success(results);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailRepository: GetTrailsByIdentifiersAsync -> Something went wrong when fetching trails by identifiers.");
            return RepositoryResult<IReadOnlyCollection<T>>.Error();
        }
    }

    public async Task<RepositoryResult<int>> GetTrailIdByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var trailId = await context.Trails
                .Where(t => t.Identifier == identifier)
                .Select(t => (int?)t.Id)
                .FirstOrDefaultAsync(ctoken);

            return trailId is null
                ? RepositoryResult<int>.NotFound()
                : RepositoryResult<int>.Success(trailId.Value);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailRepository: GetTrailIdByIdentifierAsync -> Something went wrong when fetching trail ID with identifier {identifier}.", identifier);
            return RepositoryResult<int>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyCollection<T>>> GetAllTrailMarkersAsync<T>(
        Expression<Func<Trail, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var markers = await context.Trails.AsNoTracking()
                .Where(t => t.IsVerified && t.GeoPath != null)
                .Select(selector)
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<T>>.Success(markers);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailRepository: GetAllTrailMarkersAsync -> Something went wrong when fetching trail markers.");
            return RepositoryResult<IReadOnlyCollection<T>>.Error();
        }
    }

    public async Task<RepositoryResult<Trail>> AddTrailAsync(Trail trail, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            context.Trails.Add(trail);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<Trail>.Success(trail);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailRepository: AddTrailAsync -> Something went wrong when adding trail.");
            return RepositoryResult<Trail>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyCollection<TrailImage>>> AddTrailImagesAsync(int trailId, IReadOnlyCollection<TrailImage> images, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var trailExists = await context.Trails.AnyAsync(t => t.Id == trailId, ctoken);

            if (!trailExists)
                return RepositoryResult<IReadOnlyCollection<TrailImage>>.NotFound();

            foreach (var image in images)
                image.TrailId = trailId;

            context.TrailImages.AddRange(images);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<TrailImage>>.Success(images);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailRepository: AddTrailImagesAsync -> Something went wrong when adding images to trail with ID {TrailId}.", trailId);
            return RepositoryResult<IReadOnlyCollection<TrailImage>>.Error();
        }
    }

    public async Task<RepositoryResult> UpdateTrailSymbolAsync(string trailIdentifier, string symbolPath, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var trail = await context.Trails
                .FirstOrDefaultAsync(t => t.Identifier == trailIdentifier, ctoken);

            if (trail is null)
                return RepositoryResult.NotFound();

            trail.TrailSymbolImage = symbolPath;
            trail.LastUpdatedAt = DateTime.UtcNow;

            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailRepository: UpdateTrailSymbolAsync -> Something went wrong updating symbol for trail {TrailIdentifier}.", trailIdentifier);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult> DeleteTrailImageAsync(string imageIdentifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var image = await context.TrailImages
                .Where(img => img.Identifier == imageIdentifier)
                .FirstOrDefaultAsync(ctoken);

            if (image is null)
                return RepositoryResult.NotFound();

            context.TrailImages.Remove(image);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailRepository: DeleteTrailImageAsync -> Something went wrong when deleting image with identifier {ImageIdentifier}.", imageIdentifier);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult<Trail>> UpdateTrailAsync(Trail trail, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var existing = await context.Trails
                .Include(t => t.VisitorInformation)
                .Include(t => t.TrailLinks)
                .Where(t => t.Identifier == trail.Identifier)
                .FirstOrDefaultAsync(ctoken);

            if (existing is null)
                return RepositoryResult<Trail>.NotFound();

            if (trail.TrailLinks != null)
                ReplaceTrailLinks(context, existing, trail.TrailLinks);

            existing.Name = trail.Name;
            existing.TrailLength = trail.TrailLength;
            existing.Classification = trail.Classification;
            existing.Accessibility = trail.Accessibility;
            existing.AccessibilityInfo = trail.AccessibilityInfo;
            existing.TrailSymbol = trail.TrailSymbol;
            existing.Description = trail.Description;
            existing.FullDescription = trail.FullDescription;
            existing.Tags = trail.Tags;
            existing.City = trail.City;
            existing.LastUpdatedAt = DateTime.UtcNow;

            if (trail.VisitorInformation != null)
            {
                if (existing.VisitorInformation != null)
                {
                    existing.VisitorInformation.GettingThere = trail.VisitorInformation.GettingThere;
                    existing.VisitorInformation.PublicTransport = trail.VisitorInformation.PublicTransport;
                    existing.VisitorInformation.Parking = trail.VisitorInformation.Parking;
                    existing.VisitorInformation.Illumination = trail.VisitorInformation.Illumination;
                    existing.VisitorInformation.IlluminationText = trail.VisitorInformation.IlluminationText;
                    existing.VisitorInformation.MaintainedBy = trail.VisitorInformation.MaintainedBy;
                    existing.VisitorInformation.WinterMaintenance = trail.VisitorInformation.WinterMaintenance;
                    existing.VisitorInformation.LastUpdatedAt = DateTime.UtcNow;
                }
                else
                {
                    existing.VisitorInformation = trail.VisitorInformation;
                }
            }

            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<Trail>.Success(existing);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailRepository: UpdateTrailAsync -> Something went wrong when updating trail with identifier {Identifier}.", trail.Identifier);
            return RepositoryResult<Trail>.Error();
        }
    }

    private static void ReplaceTrailLinks(StigViddDbContext context, Trail existing, ICollection<TrailLink> links)
    {
        existing.TrailLinks ??= [];
        var incoming = links.ToDictionary(l => l.Identifier);

        context.TrailLinks.RemoveRange(existing.TrailLinks.Where(l => !incoming.ContainsKey(l.Identifier)).ToList());

        var byIdentifier = existing.TrailLinks.ToDictionary(l => l.Identifier);

        foreach (var link in links)
        {
            if (byIdentifier.TryGetValue(link.Identifier, out var match))
            {
                match.Title = link.Title;
                match.Link = link.Link;
                match.LastUpdatedAt = DateTime.UtcNow;
            }
            else
            {
                existing.TrailLinks.Add(new TrailLink { Title = link.Title, Link = link.Link });
            }
        }
    }

    public async Task<RepositoryResult<IReadOnlyCollection<T>>> GetAllTrailsForAdminAsync<T>(
        Expression<Func<Trail, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var trails = await context.Trails.AsNoTracking()
                .Select(selector)
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<T>>.Success(trails);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailRepository: GetAllTrailsForAdminAsync -> Something went wrong when fetching trails.");
            return RepositoryResult<IReadOnlyCollection<T>>.Error();
        }
    }

    public async Task<RepositoryResult<T>> GetTrailByIdentifierForAdminAsync<T>(string identifier, Expression<Func<Trail, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var result = await context.Trails
                .AsNoTracking()
                .Where(t => t.Identifier == identifier)
                .Select(selector)
                .FirstOrDefaultAsync(ctoken);

            return result is null
                ? RepositoryResult<T>.NotFound()
                : RepositoryResult<T>.Success(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailRepository: GetTrailByIdentifierForAdminAsync -> Something went wrong when fetching trail with identifier {identifier}.", identifier);
            return RepositoryResult<T>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyCollection<ContributedTrailProjection>>> GetTrailsCreditedToUserAsync(int userId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var trails = await context.TrailContributions
                .AsNoTracking()
                .Where(c => c.SubmittedByUserId == userId && c.ShowSubmitterName)
                .Join(context.Trails.Where(t => t.IsVerified), c => c.TrailId, t => t.Id, (c, t) => new { c.PublishedAt, Trail = t })
                .OrderByDescending(x => x.PublishedAt)
                .Select(x => new ContributedTrailProjection(
                    x.Trail.Identifier,
                    x.Trail.Name,
                    x.Trail.TrailLength,
                    x.Trail.City,
                    context.TrailImages
                        .Where(i => i.TrailId == x.Trail.Id)
                        .OrderBy(i => i.SortOrder)
                        .Select(i => i.ImageUrl)
                        .FirstOrDefault(),
                    x.PublishedAt))
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<ContributedTrailProjection>>.Success(trails);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailRepository: GetTrailsCreditedToUserAsync -> Something went wrong when fetching trails credited to user {userId}.", userId);
            return RepositoryResult<IReadOnlyCollection<ContributedTrailProjection>>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyCollection<Services.ContributionRankingInput>>> GetContributionRankingInputsAsync(CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var rows = await context.Trails.AsNoTracking()
                .Where(t => t.IsVerified && t.GeoPath != null && t.Contribution != null)
                .Select(t => new
                {
                    t.Identifier,
                    Reviews = context.Reviews
                        .Where(r => r.TrailId == t.Id)
                        .Select(r => new { r.Rating, r.LastUpdatedAt })
                        .ToList(),
                    Likes = context.TrailContributionLikes
                        .Where(l => l.TrailId == t.Id)
                        .Select(l => l.CreatedAt)
                        .ToList(),
                })
                .ToListAsync(ctoken);

            IReadOnlyCollection<Services.ContributionRankingInput> inputs = rows
                .Select(r => new Services.ContributionRankingInput(
                    r.Identifier,
                    r.Reviews.Select(x => new Services.RankedReview(x.Rating, x.LastUpdatedAt)).ToList(),
                    r.Likes))
                .ToList();

            return RepositoryResult<IReadOnlyCollection<Services.ContributionRankingInput>>.Success(inputs);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailRepository: GetContributionRankingInputsAsync -> Something went wrong when fetching contributed trails.");
            return RepositoryResult<IReadOnlyCollection<Services.ContributionRankingInput>>.Error();
        }
    }

    public async Task<RepositoryResult<TrailLikeState>> GetTrailLikeAsync(string trailIdentifier, string userIdentifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var trailId = await ContributedTrailIdAsync(context, trailIdentifier, ctoken);
            var userId = await UserIdAsync(context, userIdentifier, ctoken);

            if (trailId is null || userId is null)
                return RepositoryResult<TrailLikeState>.NotFound();

            return RepositoryResult<TrailLikeState>.Success(await LikeStateAsync(context, trailId.Value, userId.Value, ctoken));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailRepository: GetTrailLikeAsync -> Something went wrong reading likes for trail {TrailIdentifier}.", trailIdentifier);
            return RepositoryResult<TrailLikeState>.Error();
        }
    }

    public async Task<RepositoryResult<TrailLikeState>> SetTrailLikeAsync(string trailIdentifier, string userIdentifier, bool liked, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var trailId = await ContributedTrailIdAsync(context, trailIdentifier, ctoken);
            var userId = await UserIdAsync(context, userIdentifier, ctoken);

            if (trailId is null || userId is null)
                return RepositoryResult<TrailLikeState>.NotFound();

            var existing = await context.TrailContributionLikes
                .FirstOrDefaultAsync(l => l.TrailId == trailId.Value && l.UserId == userId.Value, ctoken);

            if (liked && existing is null)
                context.TrailContributionLikes.Add(new TrailContributionLike { TrailId = trailId.Value, UserId = userId.Value });
            else if (!liked && existing is not null)
                context.TrailContributionLikes.Remove(existing);

            try
            {
                await context.SaveChangesAsync(ctoken);
            }
            catch (DbUpdateException)
            {
                // keep-comment: a concurrent like or unlike of the same pair already reached the state asked for
                context.ChangeTracker.Clear();
            }

            return RepositoryResult<TrailLikeState>.Success(await LikeStateAsync(context, trailId.Value, userId.Value, ctoken));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailRepository: SetTrailLikeAsync -> Something went wrong setting a like on trail {TrailIdentifier}.", trailIdentifier);
            return RepositoryResult<TrailLikeState>.Error();
        }
    }

    private static Task<int?> ContributedTrailIdAsync(StigViddDbContext context, string trailIdentifier, CancellationToken ctoken)
    {
        return context.Trails
            .Where(t => t.Identifier == trailIdentifier && t.IsVerified && t.Contribution != null)
            .Select(t => (int?)t.Id)
            .FirstOrDefaultAsync(ctoken);
    }

    private static Task<int?> UserIdAsync(StigViddDbContext context, string userIdentifier, CancellationToken ctoken)
    {
        return context.Users
            .Where(u => u.Identifier == userIdentifier)
            .Select(u => (int?)u.Id)
            .FirstOrDefaultAsync(ctoken);
    }

    private static async Task<TrailLikeState> LikeStateAsync(StigViddDbContext context, int trailId, int userId, CancellationToken ctoken)
    {
        return new(
            await context.TrailContributionLikes.CountAsync(l => l.TrailId == trailId, ctoken),
            await context.TrailContributionLikes.AnyAsync(l => l.TrailId == trailId && l.UserId == userId, ctoken));
    }

    public async Task<RepositoryResult> SetTrailVerifiedAsync(string identifier, bool isVerified, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var trail = await context.Trails
                .FirstOrDefaultAsync(t => t.Identifier == identifier, ctoken);

            if (trail is null)
                return RepositoryResult.NotFound();

            trail.IsVerified = isVerified;
            trail.LastUpdatedAt = DateTime.UtcNow;

            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailRepository: SetTrailVerifiedAsync -> Something went wrong when setting IsVerified on trail {Identifier}.", identifier);
            return RepositoryResult.Error();
        }
    }
}
