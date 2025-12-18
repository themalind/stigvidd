using Core.Interfaces;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using WebDataContracts.ResponseModels.Review;
using WebDataContracts.ResponseModels.Trail;

namespace Core.Services;

public class TrailService(IDbContextFactory<StigViddDbContext> context, ILogger<TrailService> logger) : ITrailService
{
    private readonly IDbContextFactory<StigViddDbContext> _context = context;
    private readonly ILogger<TrailService> _logger = logger;


    public async Task<Result<TrailResponse?>> GetTrailByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var trail = await context.Trails
              .AsNoTracking()
              .Include(t => t.TrailImages)
              .Include(t => t.TrailLinks)
              .Include(r => r.Reviews!)
                .ThenInclude(r => r.User)
              .Include(r => r.Reviews!) // Man talar om för EF att vi även vill inkludera ReviewImages ingen nullkoll behövs här, nullforgiving är ok här. Att den ka vara null är oväsentligt.
                .ThenInclude(rv => rv.ReviewImages)
              .FirstOrDefaultAsync(t => t.Identifier == identifier, ctoken);

        if (trail == null)
        {
            _logger.LogInformation(
                "TrailService -> GetTrailByIdentifierAsync: Trail with identifier {Identifier} not found.", identifier);

            return Result.Fail<TrailResponse?>(new Message(404, $"Trail with identifier { identifier } not found."));
        }

        var images = trail.TrailImages?.Select(ti =>
            TrailImageResponse.Create(
                ti.Identifier,
                ti.ImageUrl)) ?? null;

        var links = trail.TrailLinks?.Select(tl =>
            TrailLinkResponse.Create(
                tl.Identifier,
                tl.Link)) ?? null;

        var reviews = trail.Reviews?.Select(r =>
            ReviewResponse.Create(
                r.Identifier,
                r.TrailReview ?? string.Empty,
                r.Grade,
                r.User!.NickName,
                r.CreatedAt,
                trail.Identifier,
                r.User.Identifier,
                r.ReviewImages?.Select(ri =>
                    ReviewImageResponse.Create(
                        ri.Identifier,
                        ri.ImageUrl)))) ?? null;

        var trailResponse = TrailResponse.Create
        (trail.Identifier,
        trail.Name,
        trail.TrailLength,
        trail.Classification ?? string.Empty,
        trail.Accessability,
        trail.AccessabilityInfo ?? string.Empty,
        trail.TrailSymbol ?? string.Empty,
        trail.TrailSymbolImage ?? string.Empty,
        trail.Description ?? string.Empty,
        trail.CoordinatesJson ?? string.Empty,
        images,
        links,
        reviews
        );

        return Result.Ok<TrailResponse?>(trailResponse);
    }

    public async Task<Result<IReadOnlyCollection<TrailOverviewResponse?>>> GetPopularTrailOverviewsAsync(CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var trails = await context.Trails
            .Select(trail => new TrailOverviewResponse
            {
                Identifier = trail.Identifier,
                Name = trail.Name,
                TrailLength = trail.TrailLength,
                TrailImagesResponse = trail.TrailImages!
                    .Select(ti => TrailImageResponse.Create(ti.Identifier, ti.ImageUrl))
                    .Take(1)
                    .ToList()
            })
            .Take(9)
            .ToListAsync(ctoken);

        return Result.Ok<IReadOnlyCollection<TrailOverviewResponse?>>(trails);
    }
}