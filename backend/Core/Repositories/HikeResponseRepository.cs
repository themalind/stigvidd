using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using WebDataContracts.ResponseModels.Hike;

namespace Core.Repositories;

public class HikeResponseRepository : IHikeResponseRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _context;

    public HikeResponseRepository(IDbContextFactory<StigViddDbContext> context)
    {
        _context = context;
    }

    public async Task<RepositoryResult<Hike>> CreateHikeAsync(Hike hike, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        context.Hikes.Add(hike);
        await context.SaveChangesAsync(ctoken);

        return RepositoryResult<Hike>.Success(hike);
    }

    public async Task<RepositoryResult<Hike>> GetHikeByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var hike = await context.Hikes
            .FirstOrDefaultAsync(h => h.Identifier == identifier, ctoken);

        return hike is null
            ? RepositoryResult<Hike>.NotFound()
            : RepositoryResult<Hike>.Success(hike);
    }

    public async Task<RepositoryResult<IReadOnlyCollection<HikeOverviewResponse>>> GetHikesAsync(string? createdBy, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var query = context.Hikes.AsQueryable();

        if (!string.IsNullOrWhiteSpace(createdBy))
            query = query.Where(h => h.CreatedBy == createdBy);

        var hikes = await query
            .Select(h => HikeOverviewResponse.Create(
                h.Identifier,
                h.Name,
                h.HikeLength,
                h.Duration,
                h.Coordinates,
                h.CreatedBy))
            .ToListAsync(ctoken);

        return RepositoryResult<IReadOnlyCollection<HikeOverviewResponse>>.Success(hikes);
    }

    public async Task<RepositoryResult> DeleteHikeAsync(Hike hike, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        context.Remove(hike);
        await context.SaveChangesAsync(ctoken);

        return RepositoryResult.Success();
    }
}
