using Core.Factories;
using Core.Interfaces;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using WebDataContracts.RequestModels.Hike;
using WebDataContracts.ResponseModels.Hike;

namespace Core.Services;

public class HikeService : IHikeService
{
    private readonly IDbContextFactory<StigViddDbContext> _context;
    private readonly HikeResponseFactory _hikeResponseFactory;
    private readonly ILogger<HikeService> _logger;

    public HikeService(IDbContextFactory<StigViddDbContext> context, HikeResponseFactory hikeResponseFactory, ILogger<HikeService> logger)
    {
        _context = context;
        _hikeResponseFactory = hikeResponseFactory;
        _logger = logger;
    }

    public async Task<Result<HikeResponse>> CreateHikeAsync(CreateHikeRequest request, string userIdentifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        try
        {
            var user = await context.Users.FirstOrDefaultAsync(user => user.Identifier == userIdentifier, ctoken);

            if (user == null)
            {
                return Result.Fail<HikeResponse>(new Message(404, "User not found"));
            }

            var hike = new Hike
            {
                Name = request.Name,
                HikeLength = request.HikeLength / 1000,
                Duration = request.Duration,
                Coordinates = request.Coordinates,
                CreatedBy = userIdentifier
            };

            context.Hikes.Add(hike);
            await context.SaveChangesAsync(ctoken);

            _logger.LogInformation("Hike {hikeId} added successfully by user {userId}.", hike.Id, user.Id);

            return Result.Ok(_hikeResponseFactory.Create(hike));

        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating Hike by user: {userIdentifier}", userIdentifier);

            return Result.Fail<HikeResponse>(new Message(500, "An error occured while adding the hike."));
        }
    }

    public async Task<Result<HikeResponse>> GetHikeByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var hike = await context.Hikes
            .Where(hike => hike.Identifier == identifier)
            .Select(hike => HikeResponse.Create(
                hike.Identifier,
                hike.Name,
                hike.HikeLength,
                hike.Duration,
                hike.Coordinates,
                hike.CreatedBy
            ))
            .FirstOrDefaultAsync(ctoken);

        if (hike == null)
        {
            return Result.Fail<HikeResponse>(new Message(404, "Hike not found"));
        }

        return Result.Ok(hike);
    }

    public async Task<Result<IReadOnlyCollection<HikeOverviewResponse>>> GetHikesAsync(string? createdBy, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var query = context.Hikes.AsQueryable();

        if (!string.IsNullOrWhiteSpace(createdBy))
        {
            query = query.Where(hike => hike.CreatedBy == createdBy);
        }

        var hikes = await query
            .Select(hike => HikeOverviewResponse.Create(
                hike.Identifier,
                hike.Name,
                hike.HikeLength,
                hike.Duration,
                hike.Coordinates,
                hike.CreatedBy
            ))
            .ToListAsync(ctoken);

        return Result.Ok<IReadOnlyCollection<HikeOverviewResponse>>(hikes);
    }

    public async Task<Result> DeleteHikeAsync(string hikeIdentifier, string userIdentifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var hike = await context.Hikes.FirstOrDefaultAsync(hike => hike.Identifier == hikeIdentifier, ctoken);

        if (hike == null)
        {
            return Result.Fail(new Message(404, $"Could not remove hike with id {hikeIdentifier}."));
        }

        if (hike.CreatedBy != userIdentifier)
        {
            return Result.Fail(new Message(401, $"Hike {hikeIdentifier} does not belong to {userIdentifier}"));
        }

        context.Remove(hike);
        await context.SaveChangesAsync(ctoken);

        return Result.Ok();
    }
}