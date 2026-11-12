// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Repositories.Facilities;

public class FacilityImportSourceRepository : IFacilityImportSourceRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _dbContextFactory;
    private readonly ILogger<FacilityImportSourceRepository> _logger;

    public FacilityImportSourceRepository(
        IDbContextFactory<StigViddDbContext> dbContextFactory, ILogger<FacilityImportSourceRepository> logger)
    {
        _dbContextFactory = dbContextFactory;
        _logger = logger;
    }

    public async Task<RepositoryResult<IReadOnlyCollection<FacilityImportSource>>> GetAllAsync(CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var query = context.FacilityImportSources.AsNoTracking().Include(s => s.Municipality);
            var ordered = SwedishCollation.For(context) is { } collation
                ? query
                    .OrderBy(s => EF.Functions.Collate(s.Municipality == null ? "" : s.Municipality.Name, collation))
                    .ThenBy(s => EF.Functions.Collate(s.Name, collation))
                : query
                    .OrderBy(s => s.Municipality == null ? "" : s.Municipality.Name)
                    .ThenBy(s => s.Name);

            return RepositoryResult<IReadOnlyCollection<FacilityImportSource>>.Success(await ordered.ToListAsync(ctoken));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "FacilityImportSourceRepository: GetAllAsync -> Something went wrong when fetching the import sources.");
            return RepositoryResult<IReadOnlyCollection<FacilityImportSource>>.Error();
        }
    }

    public async Task<RepositoryResult<FacilityImportSource>> GetByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var source = await context.FacilityImportSources
                .AsNoTracking()
                .Include(s => s.Municipality)
                .SingleOrDefaultAsync(s => s.Identifier == identifier, ctoken);

            return source is null
                ? RepositoryResult<FacilityImportSource>.NotFound()
                : RepositoryResult<FacilityImportSource>.Success(source);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "FacilityImportSourceRepository: GetByIdentifierAsync -> Something went wrong when fetching import source {Identifier}.", identifier);
            return RepositoryResult<FacilityImportSource>.Error();
        }
    }

    public async Task<RepositoryResult<FacilityImportSource>> CreateAsync(FacilityImportSource source, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var taken = await context.FacilityImportSources.AnyAsync(
                s => s.Key == source.Key || (s.MunicipalityId == source.MunicipalityId && s.Name == source.Name), ctoken);

            if (taken)
                return RepositoryResult<FacilityImportSource>.Conflict();

            context.FacilityImportSources.Add(source);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<FacilityImportSource>.Success(source);
        }
        catch (DbUpdateException ex) when (UniqueViolation.Is(ex))
        {
            return RepositoryResult<FacilityImportSource>.Conflict();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "FacilityImportSourceRepository: CreateAsync -> Something went wrong when creating import source {Key}.", source.Key);
            return RepositoryResult<FacilityImportSource>.Error();
        }
    }
}
