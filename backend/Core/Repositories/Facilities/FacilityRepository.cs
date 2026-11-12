// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Repositories.Facilities;

public class FacilityRepository : IFacilityRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _dbContextFactory;
    private readonly ILogger<FacilityRepository> _logger;

    public FacilityRepository(IDbContextFactory<StigViddDbContext> dbContextFactory, ILogger<FacilityRepository> logger)
    {
        _dbContextFactory = dbContextFactory;
        _logger = logger;
    }

    public async Task<RepositoryResult<Facility>> CreateFacilityAsync(Facility facility, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            context.Facilities.Add(facility);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<Facility>.Success(facility);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "FacilityRepository: CreateFacilityAsync -> Something went wrong when creating facility.");
            return RepositoryResult<Facility>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyCollection<Facility>>> GetAllAsync(CancellationToken ctoken)
    {
        try
        {
            using var dbContext = await _dbContextFactory.CreateDbContextAsync(ctoken);

            // keep-comment: feeds the map markers, so a facility without coordinates is left out
            var facilities = await dbContext.Facilities
                .Where(f => f.Coordinates != null)
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<Facility>>.Success(facilities);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "FacilityRepository: GetAllAsync -> Something went wrong when fetching all facilities.");
            return RepositoryResult<IReadOnlyCollection<Facility>>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyCollection<Facility>>> GetAllIncludingUnmappedAsync(CancellationToken ctoken)
    {
        try
        {
            using var dbContext = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var facilities = await dbContext.Facilities
                .AsNoTracking()
                .OrderBy(f => f.Name)
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<Facility>>.Success(facilities);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "FacilityRepository: GetAllIncludingUnmappedAsync -> Something went wrong when fetching all facilities.");
            return RepositoryResult<IReadOnlyCollection<Facility>>.Error();
        }
    }

    public async Task<RepositoryResult<Facility>> GetByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var facility = await context.Facilities
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Identifier == identifier, ctoken);

            return facility is null
             ? RepositoryResult<Facility>.NotFound()
             : RepositoryResult<Facility>.Success(facility);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "FacilityRepository: GetByIdentifierAsync -> Something went wrong when fetching facility with identifier {identifier}", identifier);
            return RepositoryResult<Facility>.Error();
        }
    }

    public async Task<RepositoryResult<Facility>> UpdateAsync(Facility facility, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            facility.LastUpdatedAt = DateTime.UtcNow;

            context.Facilities.Update(facility);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<Facility>.Success(facility);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "FacilityRepository: UpdateAsync -> Could not update facility with identifier {identifier}", facility.Identifier);
            return RepositoryResult<Facility>.Error();
        }
    }

    public async Task<RepositoryResult> DeleteAsync(Facility facility, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            context.Facilities.Remove(facility);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "FacilityRepository: DeleteAsync -> Something went wrong when deleting facility with identifier {identifier}.", facility.Identifier);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyCollection<FacilityImage>>> AddFacilityImagesAsync(int facilityId, IReadOnlyCollection<FacilityImage> images, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var facilityExists = await context.Facilities.AnyAsync(f => f.Id == facilityId, ctoken);

            if (!facilityExists)
                return RepositoryResult<IReadOnlyCollection<FacilityImage>>.NotFound();

            foreach (var image in images)
                image.FacilityId = facilityId;

            context.FacilityImages.AddRange(images);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<FacilityImage>>.Success(images);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "FacilityRepository: AddFacilityImagesAsync -> Something went wrong when adding images to facility with ID {FacilityId}.", facilityId);
            return RepositoryResult<IReadOnlyCollection<FacilityImage>>.Error();
        }
    }

    public async Task<RepositoryResult> DeleteFacilityImageAsync(string imageIdentifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var image = await context.FacilityImages
                .FirstOrDefaultAsync(img => img.Identifier == imageIdentifier, ctoken);

            if (image is null)
                return RepositoryResult.NotFound();

            context.FacilityImages.Remove(image);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "FacilityRepository: DeleteFacilityImageAsync -> Something went wrong when deleting image with identifier {ImageIdentifier}.", imageIdentifier);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyCollection<Facility>>> GetImportCandidatesAsync(
        string sourceName, FacilityType facilityType, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var prefix = sourceName + ":";
            var facilities = await context.Facilities
                .AsNoTracking()
                .Where(f => f.SourceId != null
                    ? f.SourceId.StartsWith(prefix)
                    : (f.FacilityType & facilityType) != 0)
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<Facility>>.Success(facilities);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "FacilityRepository: GetImportCandidatesAsync -> Something went wrong when fetching import candidates for {SourceName}.", sourceName);
            return RepositoryResult<IReadOnlyCollection<Facility>>.Error();
        }
    }

    public async Task<RepositoryResult> ApplyImportAsync(
        int sourceId, string mapping, IReadOnlyCollection<Facility> creates, IReadOnlyCollection<Facility> updates, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var now = DateTime.UtcNow;
            var source = await context.FacilityImportSources.SingleOrDefaultAsync(s => s.Id == sourceId, ctoken);

            if (source is null)
                return RepositoryResult.Conflict();

            source.Mapping = mapping;
            source.LastUpdatedAt = now;

            // keep-comment: only the fields the import owns are written, so an edit to anything else since the preview survives
            foreach (var facility in updates)
            {
                facility.LastUpdatedAt = now;
                var entry = context.Facilities.Attach(facility);
                entry.Property(f => f.Description).IsModified = true;
                entry.Property(f => f.Url).IsModified = true;
                entry.Property(f => f.Coordinates).IsModified = true;
                entry.Property(f => f.FacilityType).IsModified = true;
                entry.Property(f => f.SourceId).IsModified = true;
                entry.Property(f => f.SourceSnapshot).IsModified = true;
                entry.Property(f => f.LastUpdatedAt).IsModified = true;
            }

            context.Facilities.AddRange(creates);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (DbUpdateConcurrencyException ex)
        {
            _logger.LogWarning(ex, "FacilityRepository: ApplyImportAsync -> A facility was deleted while the import ran.");
            return RepositoryResult.Conflict();
        }
        catch (DbUpdateException ex) when (UniqueViolation.Is(ex))
        {
            _logger.LogWarning(ex, "FacilityRepository: ApplyImportAsync -> Another import created the same source facility first.");
            return RepositoryResult.Conflict();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "FacilityRepository: ApplyImportAsync -> Something went wrong when applying a facility import.");
            return RepositoryResult.Error();
        }
    }
}
