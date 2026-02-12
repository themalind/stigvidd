using Core.Factories;
using Core.Interfaces;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using WebDataContracts.ResponseModels.Trail;

namespace Core.Services;

public class TrailService : ITrailService
{
    private readonly IDbContextFactory<StigViddDbContext> _context;
    private readonly ILogger<TrailService> _logger;
    private readonly TrailResponseFactory _trailResponseFactory;

    public TrailService(IDbContextFactory<StigViddDbContext> context, ILogger<TrailService> logger, TrailResponseFactory factory)
    {
        _context = context;
        _logger = logger;
        _trailResponseFactory = factory;
    }

    public async Task<Result<TrailResponse?>> GetTrailByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var trail = await context.Trails
              .AsNoTracking()
              .Include(t => t.TrailImages)
              .Include(t => t.TrailLinks)
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
            .AsNoTracking()
            .Where(trail => trail.IsVerified == true)
            .Select(trail => TrailOverviewResponse.Create
            (
                trail.Identifier,
                trail.Name,
                trail.TrailLength,
                trail.TrailImages!
                    .Select(trailImages => TrailImageResponse.Create(
                        trailImages.Identifier, 
                        trailImages.ImageUrl))
                    .Take(1)
                    .ToList()
            ))
            .Take(10)
            .ToListAsync(ctoken);

        return Result.Ok<IReadOnlyCollection<TrailOverviewResponse?>>(trails);
    }

    public async Task<Result<IReadOnlyCollection<TrailShortInfoResponse>>> GetAllTrailsWithBasicInfoAsync(CancellationToken ctoken)
    {
       using var context = await _context.CreateDbContextAsync(ctoken);

        var trailsWithShortInfo = await context.Trails
            .AsNoTracking()
            //.Where(trail => trail.IsVerified == true)
            .Select(trail => TrailShortInfoResponse.Create(
                trail.Identifier,
                trail.Name,
                trail.TrailLength,
                trail.Accessibility,
                trail.Classification,
                trail.City
            ))
            .ToListAsync(ctoken);

        return Result.Ok<IReadOnlyCollection<TrailShortInfoResponse>>(trailsWithShortInfo);
    }
}