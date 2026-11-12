// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Repositories.Municipalities;

public class MunicipalityRepository : IMunicipalityRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _dbContextFactory;
    private readonly ILogger<MunicipalityRepository> _logger;

    public MunicipalityRepository(IDbContextFactory<StigViddDbContext> dbContextFactory, ILogger<MunicipalityRepository> logger)
    {
        _dbContextFactory = dbContextFactory;
        _logger = logger;
    }

    public async Task<RepositoryResult<IReadOnlyCollection<Municipality>>> GetAllAsync(CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var query = context.Municipalities.AsNoTracking();
            var ordered = SwedishCollation.For(context) is { } collation
                ? query.OrderBy(m => EF.Functions.Collate(m.Name, collation))
                : query.OrderBy(m => m.Name);

            return RepositoryResult<IReadOnlyCollection<Municipality>>.Success(await ordered.ToListAsync(ctoken));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MunicipalityRepository: GetAllAsync -> Something went wrong when fetching the municipalities.");
            return RepositoryResult<IReadOnlyCollection<Municipality>>.Error();
        }
    }

    public async Task<RepositoryResult<Municipality>> GetByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var municipality = await context.Municipalities
                .AsNoTracking()
                .SingleOrDefaultAsync(m => m.Identifier == identifier, ctoken);

            return municipality is null
                ? RepositoryResult<Municipality>.NotFound()
                : RepositoryResult<Municipality>.Success(municipality);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MunicipalityRepository: GetByIdentifierAsync -> Something went wrong when fetching municipality {Identifier}.", identifier);
            return RepositoryResult<Municipality>.Error();
        }
    }

    public async Task<RepositoryResult<Municipality>> CreateAsync(Municipality municipality, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var taken = await context.Municipalities
                .AnyAsync(m => m.Name == municipality.Name || m.Slug == municipality.Slug, ctoken);

            if (taken)
                return RepositoryResult<Municipality>.Conflict();

            context.Municipalities.Add(municipality);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<Municipality>.Success(municipality);
        }
        catch (DbUpdateException ex) when (UniqueViolation.Is(ex))
        {
            return RepositoryResult<Municipality>.Conflict();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MunicipalityRepository: CreateAsync -> Something went wrong when creating municipality {Name}.", municipality.Name);
            return RepositoryResult<Municipality>.Error();
        }
    }
}
