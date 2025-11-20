using Core.Interfaces;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Core.Services;

    public class TrailService(IDbContextFactory<StigViddDbContext> context) : ITrailService
    {
        private readonly IDbContextFactory<StigViddDbContext> _context = context;

    public Task<IReadOnlyCollection<Trail?>> GetPopularTrailsAsync(CancellationToken ctoken)
    {
        throw new NotImplementedException();
    }

    public Task<IReadOnlyCollection<Trail?>> GetTrailsAsync(CancellationToken ctoken)
    {
        throw new NotImplementedException();
    }
}

