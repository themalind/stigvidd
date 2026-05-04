using System.Linq.Expressions;
using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Core.Repositories;

public class HikeRepository : IHikeRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _context;

    public HikeRepository(IDbContextFactory<StigViddDbContext> context)
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

    public async Task<RepositoryResult<IReadOnlyCollection<T>>> GetHikesAsync<T>(string? createdBy, Expression<Func<Hike, T>> selector, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var query = context.Hikes.AsQueryable();

        if (!string.IsNullOrWhiteSpace(createdBy))
            query = query.Where(h => h.CreatedBy == createdBy);

        var hikes = await query
            .Select(selector)
            .ToListAsync(ctoken);

        return RepositoryResult<IReadOnlyCollection<T>>.Success(hikes);
    }

    public async Task<RepositoryResult> DeleteHikeAsync(Hike hike, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        context.Remove(hike);
        await context.SaveChangesAsync(ctoken);

        return RepositoryResult.Success();
    }
}
