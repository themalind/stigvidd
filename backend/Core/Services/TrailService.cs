using Core.Interfaces;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using WebDataContracts.ResponseModels;
using WebDataContracts.ViewModels;

namespace Core.Services;

public class TrailService(IDbContextFactory<StigViddDbContext> context, ILogger<TrailService> logger) : ITrailService
{
    private readonly IDbContextFactory<StigViddDbContext> _context = context;
    private readonly ILogger<TrailService> _logger = logger;

    public async Task<IReadOnlyCollection<TrailDTO?>> GetTrailsAsync(CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var trails = await context.Trails
             .AsNoTracking()
             .Include(t => t.TrailImages)
             .Include(t => t.TrailLinks)
             .Include(r => r.Reviews!)
                .ThenInclude(r => r.User)
             .ToListAsync(ctoken);

        var dtoList = new List<TrailDTO>();

        foreach (var trail in trails)
        {
            var images = trail.TrailImages?.Select(ti => 
                TrailImageDTO.Create(
                    ti.Identifier, 
                    ti.ImageUrl, 
                    ti.Identifier));

            var links = trail.TrailLinks?.Select(tl => 
            TrailLinkDTO.Create(
                tl.Identifier, 
                tl.Link, 
                tl.Identifier));

            var reviews = trail.Reviews?.Select(r =>
                ReviewDTO.Create(
                    r.Identifier,
                    r.TrailReview,
                    r.Grade,
                    r.User!.NickName,
                    r.Identifier,
                    r.Identifier,
                    r.ReviewImages?.Select(ri =>
                        ReviewImageDTO.Create(
                            ri.Identifier,
                            ri.ImageUrl,
                            ri.Review!.Identifier))));

            var trailDto = TrailDTO.Create
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

    public async Task<TrailDTO?> GetTrailByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var trail = await context.Trails
              .AsNoTracking()
              .Include(t => t.TrailImages)
              .Include(t => t.TrailLinks)
              .Include(r => r.Reviews!)
                .ThenInclude(r => r.User)
              .Include(r => r.Reviews!)
                .ThenInclude(rv => rv.ReviewImages)
              .FirstOrDefaultAsync(t => t.Identifier == identifier, ctoken);

        if (trail == null)
        {
            _logger.LogInformation(
                "TrailService -> GetTrailByIdentifierAsync: Trail with identifier {Identifier} not found.", identifier);

            return null;
        }

        var images = trail.TrailImages?.Select(ti =>
            TrailImageDTO.Create(
                ti.Identifier,
                ti.ImageUrl,
                trail.Identifier)) ?? null;

        var links = trail.TrailLinks?.Select(tl =>
            TrailLinkDTO.Create(
                tl.Identifier,
                tl.Link,
                trail.Identifier)) ?? null;

        var reviews = trail.Reviews?.Select(r =>
            ReviewDTO.Create(
                r.Identifier,
                r.TrailReview ?? string.Empty,
                r.Grade,
                r.User!.NickName,
                trail.Identifier,
                r.User.Identifier,
                r.ReviewImages?.Select(ri =>
                    ReviewImageDTO.Create(
                        ri.Identifier,
                        ri.ImageUrl,
                        ri.Review!.Identifier)))) ?? null;

        var trailDto = TrailDTO.Create
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

    public async Task<IReadOnlyCollection<TrailOverviewViewModel?>> GetPopularTrailOverviewsAsync(CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var trails = await context.Trails
            .Select(trail => new TrailOverviewViewModel
            {
                Identifier = trail.Identifier,
                Name = trail.Name,
                TrailLength = trail.TrailLength,
                TrailImageDTOs = trail.TrailImages!
                    .Select(ti => TrailImageDTO.Create(ti.Identifier, ti.ImageUrl, ti.Trail!.Identifier))
                    .Take(1)
                    .ToList()
            })
            .Take(9)
            .ToListAsync(ctoken);

        return trails;
    }
}