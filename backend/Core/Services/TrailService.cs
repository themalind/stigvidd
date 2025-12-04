using Core.Interfaces;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using WebDataContracts.ResponseModels;
using WebDataContracts.ViewModels;

namespace Core.Services;

public class TrailService(IDbContextFactory<StigViddDbContext> context) : ITrailService
{
    private readonly IDbContextFactory<StigViddDbContext> _context = context;

    public async Task<IReadOnlyCollection<TrailDTO?>> GetTrailsAsync(CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync();

        var trails = await context.Trails
             .AsNoTracking()
             .Include(t => t.TrailImages)
             .Include(t => t.TrailLinks)
             .Include(r => r.Reviews)
             .ToListAsync(ctoken);

        var list = new List<TrailDTO>();

        foreach (var trail in trails)
        {
            var images = trail.TrailImages?.Select(ti => TrailImageDTO.Create(ti.Identifier, ti.ImageUrl, ti.TrailId));
            var links = trail.TrailLinks?.Select(tl => TrailLinkDTO.Create(tl.Identifier, tl.Link, tl.TrailId));
            var reviews = trail.Reviews?.Select(r => ReviewDTO.Create(r.Identifier, r.TrailReview, r.Grade, r.TrailId, r.UserId, null));
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

            list.Add(trailDto);
        } 
        return list;
    }

    public async Task<TrailDTO?> GetTrailByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync();

        var trail = await context.Trails
              .AsNoTracking()
              .Include(t => t.TrailImages)
              .Include(t => t.TrailLinks)
              .Include(r => r.Reviews!)
                 .ThenInclude(rv => rv.ReviewImages)
              .FirstOrDefaultAsync(t => t.Identifier == identifier, ctoken);

        if (trail == null)
        {
            return null;
        }

        var images = trail.TrailImages?.Select(ti => TrailImageDTO.Create(ti.Identifier ?? string.Empty, ti.ImageUrl ?? string.Empty, ti.TrailId))
                           ?? Enumerable.Empty<TrailImageDTO>();
        var links = trail.TrailLinks?.Select(tl => TrailLinkDTO.Create(tl.Identifier ?? string.Empty, tl.Link ?? string.Empty, tl.TrailId))
                    ?? Enumerable.Empty<TrailLinkDTO>();
        var reviews = trail.Reviews?.Select(r => ReviewDTO.Create(r.Identifier ?? string.Empty, r.TrailReview ?? string.Empty, r.Grade, r.TrailId, r.UserId, null))
                      ?? Enumerable.Empty<ReviewDTO>();

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
            .AsNoTracking()
            .Include(i => i.TrailImages)
            .Take(8)
            .ToListAsync(ctoken);
            
        var trailOverview = trails.Select(t => 
            TrailOverviewViewModel.Create(
                t.Identifier, 
                t.Name, 
                t.TrailLength, 
                t.TrailImages?
                    .Select(ti => TrailImageDTO.Create(ti.Identifier, ti.ImageUrl, ti.TrailId))
                    .Take(1)

            )).ToList();

        return trailOverview;
    }
}

