using Core.Interfaces;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using WebDataContracts.ResponseModels;

namespace Core.Services;

public class TrailService(IDbContextFactory<StigViddDbContext> context, ILogger<TrailService> logger) : ITrailService
{
    private readonly IDbContextFactory<StigViddDbContext> _context = context;
    private readonly ILogger<TrailService> _logger = logger;

    public async Task<IReadOnlyCollection<TrailResponse?>> GetTrailsAsync(CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var trails = await context.Trails
             .AsNoTracking()
             .Include(t => t.TrailImages)
             .Include(t => t.TrailLinks)
             .Include(r => r.Reviews!)
                .ThenInclude(r => r.User)
             .ToListAsync(ctoken);

        var dtoList = new List<TrailResponse>();

        foreach (var trail in trails)
        {
            var images = trail.TrailImages?.Select(ti =>
                TrailImageResponse.Create(
                    ti.Identifier,
                    ti.ImageUrl));

            var links = trail.TrailLinks?.Select(tl =>
            TrailLinkResponse.Create(
                tl.Identifier,
                tl.Link));

            var reviews = trail.Reviews?.Select(r =>
                ReviewResponse.Create(
                    r.Identifier,
                    r.TrailReview,
                    r.Grade,
                    r.User!.NickName,
                    r.CreatedAt,
                    r.Identifier,
                    r.Identifier,
                    r.ReviewImages?.Select(ri =>
                        ReviewImageResponse.Create(
                            ri.Identifier,
                            ri.ImageUrl))));

            var trailDto = TrailResponse.Create
            (trail.Identifier,
            trail.Name,
            trail.TrailLength,
            trail.Classification,
            trail.Accessability,
            trail.AccessabilityInfo,
            trail.TrailSymbol,
            trail.TrailSymbolImage,
            trail.Description,
            trail.CoordinatesJson ?? "",
            images,
            links,
            reviews
            );

            dtoList.Add(trailDto);
        }
        return dtoList;
    }

    public async Task<TrailResponse?> GetTrailByIdentifierAsync(string identifier, CancellationToken ctoken)
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

            return null;
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

        var trailDto = TrailResponse.Create
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

        return trailDto;
    }

    public async Task<IReadOnlyCollection<TrailOverviewResponse?>> GetPopularTrailOverviewsAsync(CancellationToken ctoken)
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

        return trails;
    }
}