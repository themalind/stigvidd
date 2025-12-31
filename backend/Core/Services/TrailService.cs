using Core.Factories;
using Core.Interfaces;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using WebDataContracts.ResponseModels.Trail;

namespace Core.Services;

public class TrailService(IDbContextFactory<StigViddDbContext> context, ILogger<TrailService> logger, TrailResponseFactory factory) : ITrailService
{
    private readonly IDbContextFactory<StigViddDbContext> _context = context;
    private readonly ILogger<TrailService> _logger = logger;
    private readonly TrailResponseFactory _trailResponseFactory = factory;

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

        var trailResponse = _trailResponseFactory.Create(trail);

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