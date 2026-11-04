// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Linq.Expressions;
using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Repositories;

public class CityAreaRepository : ICityAreaRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _dbContextFactory;
    private readonly ILogger<CityAreaRepository> _logger;

    public CityAreaRepository(IDbContextFactory<StigViddDbContext> dbContextFactory, ILogger<CityAreaRepository> logger)
    {
        _dbContextFactory = dbContextFactory;
        _logger = logger;
    }

    public async Task<RepositoryResult<IReadOnlyCollection<T>>> GetAllAsync<T>(
     Expression<Func<CityArea, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var cityAreas = await context.CityAreas
                .AsNoTracking()
                .Select(selector)
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<T>>.Success(cityAreas);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "CityAreaRepository: GetAllAsync -> Something went wrong when fetching all city areas.");
            return RepositoryResult<IReadOnlyCollection<T>>.Error();
        }
    }

    public async Task<RepositoryResult<T>> GetByIdentifierAsync<T>(
        string identifier, Expression<Func<CityArea, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var cityArea = await context.CityAreas
                .AsNoTracking()
                .Where(x => x.Identifier == identifier)
                .Select(selector)
                .FirstOrDefaultAsync(ctoken);

            return cityArea is null
                ? RepositoryResult<T>.NotFound()
                : RepositoryResult<T>.Success(cityArea);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "CityAreaRepository: GetByIdentifierAsync -> Something went wrong when fetching city area with identifier {identifier}", identifier);
            return RepositoryResult<T>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyCollection<AdminCityAreaProjection>>> GetAllForAdminAsync(CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var areas = await context.CityAreas
                .AsNoTracking()
                .OrderBy(a => a.Name)
                .Select(a => new { a.Id, a.Identifier, a.Name, a.Location })
                .ToListAsync(ctoken);

            var facilityLinks = await (
                from link in context.Set<Dictionary<string, object>>(FacilityLinkTable)
                join facility in context.Facilities on EF.Property<int>(link, FacilityKey) equals facility.Id
                orderby facility.Name
                select new
                {
                    AreaId = EF.Property<int>(link, AreaKey),
                    Facility = new AdminCityAreaFacilityProjection(facility.Identifier, facility.Name, (int)facility.FacilityType)
                })
                .AsNoTracking()
                .ToListAsync(ctoken);

            var trailLinks = await (
                from link in context.Set<Dictionary<string, object>>(TrailLinkTable)
                join trail in context.Trails on EF.Property<int>(link, TrailKey) equals trail.Id
                orderby trail.Name
                select new
                {
                    AreaId = EF.Property<int>(link, AreaKey),
                    Trail = new AdminCityAreaTrailProjection(trail.Identifier, trail.Name, trail.IsVerified)
                })
                .AsNoTracking()
                .ToListAsync(ctoken);

            var facilitiesByArea = facilityLinks.ToLookup(l => l.AreaId, l => l.Facility);
            var trailsByArea = trailLinks.ToLookup(l => l.AreaId, l => l.Trail);

            var result = areas
                .Select(a => new AdminCityAreaProjection(
                    a.Identifier,
                    a.Name,
                    a.Location,
                    facilitiesByArea[a.Id].ToList(),
                    trailsByArea[a.Id].ToList()))
                .ToList();

            return RepositoryResult<IReadOnlyCollection<AdminCityAreaProjection>>.Success(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "CityAreaRepository: GetAllForAdminAsync -> Something went wrong when fetching city areas for admin.");
            return RepositoryResult<IReadOnlyCollection<AdminCityAreaProjection>>.Error();
        }
    }

    public async Task<RepositoryResult> SetFacilityLinkAsync(
        string areaIdentifier, string facilityIdentifier, bool linked, CancellationToken ctoken)
    {
        return await SetLinkAsync(
            FacilityLinkTable,
            FacilityKey,
            areaIdentifier,
            context => context.Facilities
                .Where(f => f.Identifier == facilityIdentifier)
                .Select(f => (int?)f.Id)
                .FirstOrDefaultAsync(ctoken),
            linked,
            ctoken);
    }

    public async Task<RepositoryResult> SetTrailLinkAsync(
        string areaIdentifier, string trailIdentifier, bool linked, CancellationToken ctoken)
    {
        return await SetLinkAsync(
            TrailLinkTable,
            TrailKey,
            areaIdentifier,
            context => context.Trails
                .Where(t => t.Identifier == trailIdentifier)
                .Select(t => (int?)t.Id)
                .FirstOrDefaultAsync(ctoken),
            linked,
            ctoken);
    }

    private const string FacilityLinkTable = "CityAreaFacility";
    private const string TrailLinkTable = "CityAreaTrail";
    private const string AreaKey = "CityAreaId";
    private const string FacilityKey = "FacilityId";
    private const string TrailKey = "TrailId";

    private async Task<RepositoryResult> SetLinkAsync(
        string joinTable,
        string otherKey,
        string areaIdentifier,
        Func<StigViddDbContext, Task<int?>> findOtherId,
        bool linked,
        CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var areaId = await context.CityAreas
                .Where(a => a.Identifier == areaIdentifier)
                .Select(a => (int?)a.Id)
                .FirstOrDefaultAsync(ctoken);
            var otherId = await findOtherId(context);

            if (areaId is not int area || otherId is not int other)
                return RepositoryResult.NotFound();

            var links = context.Set<Dictionary<string, object>>(joinTable);
            var existing = await links.FirstOrDefaultAsync(
                l => EF.Property<int>(l, AreaKey) == area && EF.Property<int>(l, otherKey) == other,
                ctoken);

            if (linked && existing is null)
                links.Add(new Dictionary<string, object> { [AreaKey] = area, [otherKey] = other });
            else if (!linked && existing is not null)
                links.Remove(existing);

            await context.SaveChangesAsync(ctoken);
            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "CityAreaRepository: SetLinkAsync -> Something went wrong when updating {table} for city area {identifier}", joinTable, areaIdentifier);
            return RepositoryResult.Error();
        }
    }
}
