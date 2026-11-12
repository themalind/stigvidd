// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Linq.Expressions;
using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Geometries;

namespace Core.Repositories.CityAreas;

public class CityAreaRepository : ICityAreaRepository
{
    private const string FacilityLinkTable = "CityAreaFacility";
    private const string TrailLinkTable = "CityAreaTrail";
    private const string AreaKey = "CityAreaId";
    private const string FacilityKey = "FacilityId";
    private const string TrailKey = "TrailId";
    private const string ManualKey = "IsManual";

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
                .Select(a => new
                {
                    a.Id,
                    a.Identifier,
                    a.Name,
                    a.Location,
                    a.Boundary,
                    MunicipalityIdentifier = a.Municipality != null ? a.Municipality.Identifier : null,
                })
                .ToListAsync(ctoken);

            var facilityLinks = await (
                from link in context.Set<Dictionary<string, object>>(FacilityLinkTable)
                join facility in context.Facilities on EF.Property<int>(link, FacilityKey) equals facility.Id
                orderby facility.Name
                select new
                {
                    AreaId = EF.Property<int>(link, AreaKey),
                    Facility = new AdminCityAreaFacilityProjection(
                        facility.Identifier, facility.Name, (int)facility.FacilityType, EF.Property<bool>(link, ManualKey))
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
                    Trail = new AdminCityAreaTrailProjection(trail.Identifier, trail.Name, trail.IsVerified, EF.Property<bool>(link, ManualKey))
                })
                .AsNoTracking()
                .ToListAsync(ctoken);

            var excludedFacilities = await (
                from exclusion in context.CityAreaFacilityExclusions
                join facility in context.Facilities on exclusion.FacilityId equals facility.Id
                orderby facility.Name
                select new
                {
                    AreaId = exclusion.CityAreaId,
                    Facility = new AdminCityAreaFacilityProjection(facility.Identifier, facility.Name, (int)facility.FacilityType, false)
                })
                .AsNoTracking()
                .ToListAsync(ctoken);

            var excludedTrails = await (
                from exclusion in context.CityAreaTrailExclusions
                join trail in context.Trails on exclusion.TrailId equals trail.Id
                orderby trail.Name
                select new
                {
                    AreaId = exclusion.CityAreaId,
                    Trail = new AdminCityAreaTrailProjection(trail.Identifier, trail.Name, trail.IsVerified, false)
                })
                .AsNoTracking()
                .ToListAsync(ctoken);

            var facilitiesByArea = facilityLinks.ToLookup(l => l.AreaId, l => l.Facility);
            var trailsByArea = trailLinks.ToLookup(l => l.AreaId, l => l.Trail);
            var excludedFacilitiesByArea = excludedFacilities.ToLookup(e => e.AreaId, e => e.Facility);
            var excludedTrailsByArea = excludedTrails.ToLookup(e => e.AreaId, e => e.Trail);

            var result = areas
                .Select(a => new AdminCityAreaProjection(
                    a.Identifier,
                    a.Name,
                    a.Location,
                    a.MunicipalityIdentifier,
                    a.Boundary,
                    facilitiesByArea[a.Id].ToList(),
                    trailsByArea[a.Id].ToList(),
                    excludedFacilitiesByArea[a.Id].ToList(),
                    excludedTrailsByArea[a.Id].ToList()))
                .ToList();

            return RepositoryResult<IReadOnlyCollection<AdminCityAreaProjection>>.Success(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "CityAreaRepository: GetAllForAdminAsync -> Something went wrong when fetching city areas for admin.");
            return RepositoryResult<IReadOnlyCollection<AdminCityAreaProjection>>.Error();
        }
    }

    public async Task<RepositoryResult<LinkSuggestionSourcesProjection>> GetLinkSuggestionSourcesAsync(CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var areas = await context.CityAreas
                .AsNoTracking()
                .OrderBy(a => a.Name)
                .Select(a => new { a.Id, a.Identifier, a.Name })
                .ToListAsync(ctoken);

            var facilityPlaces = await (
                from link in context.Set<Dictionary<string, object>>(FacilityLinkTable)
                join facility in context.Facilities on EF.Property<int>(link, FacilityKey) equals facility.Id
                where facility.Coordinates != null
                select new
                {
                    AreaId = EF.Property<int>(link, AreaKey),
                    facility.Name,
                    Latitude = facility.Coordinates == null ? 0.0 : facility.Coordinates.Y,
                    Longitude = facility.Coordinates == null ? 0.0 : facility.Coordinates.X,
                })
                .AsNoTracking()
                .ToListAsync(ctoken);

            var trailPlaces = await (
                from link in context.Set<Dictionary<string, object>>(TrailLinkTable)
                join trail in context.Trails on EF.Property<int>(link, TrailKey) equals trail.Id
                where trail.GeoPath != null
                select new
                {
                    AreaId = EF.Property<int>(link, AreaKey),
                    trail.Name,
                    Latitude = trail.GeoPath == null ? 0.0 : trail.GeoPath.StartPoint.Y,
                    Longitude = trail.GeoPath == null ? 0.0 : trail.GeoPath.StartPoint.X,
                })
                .AsNoTracking()
                .ToListAsync(ctoken);

            var facilities = await context.Facilities
                .AsNoTracking()
                .Where(f => !context.Set<Dictionary<string, object>>(FacilityLinkTable)
                    .Any(link => EF.Property<int>(link, FacilityKey) == f.Id))
                .OrderBy(f => f.Name)
                .Select(f => new UnlinkedFacilityProjection(
                    f.Identifier,
                    f.Name,
                    (int)f.FacilityType,
                    f.Coordinates == null ? null : f.Coordinates.Y,
                    f.Coordinates == null ? null : f.Coordinates.X))
                .ToListAsync(ctoken);

            var trails = await context.Trails
                .AsNoTracking()
                .Where(t => t.Contribution == null)
                .Where(t => !context.Set<Dictionary<string, object>>(TrailLinkTable)
                    .Any(link => EF.Property<int>(link, TrailKey) == t.Id))
                .OrderBy(t => t.Name)
                .Select(t => new UnlinkedTrailProjection(
                    t.Identifier,
                    t.Name,
                    t.City,
                    t.IsVerified,
                    t.GeoPath == null ? null : t.GeoPath.StartPoint.Y,
                    t.GeoPath == null ? null : t.GeoPath.StartPoint.X))
                .ToListAsync(ctoken);

            var placesByArea = facilityPlaces
                .Select(p => (p.AreaId, Place: new LinkedPlaceProjection(p.Name, p.Latitude, p.Longitude)))
                .Concat(trailPlaces.Select(p => (p.AreaId, Place: new LinkedPlaceProjection(p.Name, p.Latitude, p.Longitude))))
                .ToLookup(p => p.AreaId, p => p.Place);

            var suggestionAreas = areas
                .Select(a => new SuggestionAreaProjection(a.Identifier, a.Name, placesByArea[a.Id].ToList()))
                .ToList();

            return RepositoryResult<LinkSuggestionSourcesProjection>.Success(
                new LinkSuggestionSourcesProjection(suggestionAreas, facilities, trails));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "CityAreaRepository: GetLinkSuggestionSourcesAsync -> Something went wrong when fetching unlinked facilities and trails.");
            return RepositoryResult<LinkSuggestionSourcesProjection>.Error();
        }
    }

    public async Task<RepositoryResult> SetFacilityLinkAsync(
        string areaIdentifier, string facilityIdentifier, bool linked, CancellationToken ctoken)
    {
        return await SetLinkAsync(FacilityLinks, areaIdentifier, facilityIdentifier, linked, ctoken);
    }

    public async Task<RepositoryResult> SetTrailLinkAsync(
        string areaIdentifier, string trailIdentifier, bool linked, CancellationToken ctoken)
    {
        return await SetLinkAsync(TrailLinks, areaIdentifier, trailIdentifier, linked, ctoken);
    }

    public async Task<RepositoryResult> RemoveFacilityExclusionAsync(string areaIdentifier, string facilityIdentifier, CancellationToken ctoken)
    {
        return await RemoveExclusionAsync(FacilityLinks, areaIdentifier, facilityIdentifier, ctoken);
    }

    public async Task<RepositoryResult> RemoveTrailExclusionAsync(string areaIdentifier, string trailIdentifier, CancellationToken ctoken)
    {
        return await RemoveExclusionAsync(TrailLinks, areaIdentifier, trailIdentifier, ctoken);
    }

    private async Task<RepositoryResult> SetLinkAsync(
        LinkKind kind, string areaIdentifier, string itemIdentifier, bool linked, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var area = await FindAreaAsync(context, areaIdentifier, ctoken);
            var item = await kind.FindItem(context, itemIdentifier, ctoken);

            if (area is null || item is null)
                return RepositoryResult.NotFound();

            var exclusion = await context.FindAsync(kind.ExclusionType, [area.Id, item.Id], ctoken);

            if (linked)
            {
                if (exclusion is not null)
                    context.Remove(exclusion);

                await SetManualLinkAsync(context, kind.Table, kind.Key, area.Id, item.Id, ctoken);
            }
            else
            {
                await RemoveLinkAsync(context, kind.Table, kind.Key, area.Id, item.Id, ctoken);

                if (exclusion is null && area.Boundary is { } boundary && item.IsInside(boundary))
                    context.Add(kind.NewExclusion(area.Id, item.Id));
            }

            await context.SaveChangesAsync(ctoken);
            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "CityAreaRepository: SetLinkAsync -> Something went wrong when linking {kind} {item} to city area {identifier}", kind.Name, itemIdentifier, areaIdentifier);
            return RepositoryResult.Error();
        }
    }

    private async Task<RepositoryResult> RemoveExclusionAsync(
        LinkKind kind, string areaIdentifier, string itemIdentifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var area = await FindAreaAsync(context, areaIdentifier, ctoken);
            var item = await kind.FindItem(context, itemIdentifier, ctoken);

            if (area is null || item is null)
                return RepositoryResult.NotFound();

            var exclusion = await context.FindAsync(kind.ExclusionType, [area.Id, item.Id], ctoken);

            if (exclusion is null)
                return RepositoryResult.Success();

            context.Remove(exclusion);

            if (area.Boundary is { } boundary && item.IsInside(boundary))
                await AddLinkAsync(context, kind.Table, kind.Key, area.Id, item.Id, ctoken);

            await context.SaveChangesAsync(ctoken);
            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "CityAreaRepository: RemoveExclusionAsync -> Something went wrong for {kind} {item} in city area {identifier}", kind.Name, itemIdentifier, areaIdentifier);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult<BoundarySuggestionSourcesProjection>> GetBoundarySuggestionSourcesAsync(string areaIdentifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var area = await FindAreaAsync(context, areaIdentifier, ctoken);

            if (area is null)
                return RepositoryResult<BoundarySuggestionSourcesProjection>.NotFound();

            var paths = await Counted(LinkedTrails(context, area.Id))
                .Select(t => t.GeoPath)
                .ToListAsync(ctoken);

            var points = await (
                from link in context.Set<Dictionary<string, object>>(FacilityLinkTable)
                join facility in context.Facilities on EF.Property<int>(link, FacilityKey) equals facility.Id
                where EF.Property<int>(link, AreaKey) == area.Id && facility.Coordinates != null
                select facility.Coordinates)
                .AsNoTracking()
                .ToListAsync(ctoken);

            return RepositoryResult<BoundarySuggestionSourcesProjection>.Success(
                new BoundarySuggestionSourcesProjection([.. paths.OfType<LineString>()], [.. points.OfType<Point>()]));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "CityAreaRepository: GetBoundarySuggestionSourcesAsync -> Something went wrong for city area {identifier}", areaIdentifier);
            return RepositoryResult<BoundarySuggestionSourcesProjection>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyCollection<AreaTrailPathProjection>>> GetTrailPathsAsync(string areaIdentifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var area = await FindAreaAsync(context, areaIdentifier, ctoken);

            if (area is null)
                return RepositoryResult<IReadOnlyCollection<AreaTrailPathProjection>>.NotFound();

            var trails = await LinkedTrails(context, area.Id)
                .Where(t => t.GeoPath != null)
                .Select(t => new { t.Identifier, t.GeoPath })
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<AreaTrailPathProjection>>.Success(
                [.. trails
                    .Select(t => t.GeoPath is { } path ? new AreaTrailPathProjection(t.Identifier, path) : null)
                    .OfType<AreaTrailPathProjection>()]);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "CityAreaRepository: GetTrailPathsAsync -> Something went wrong for city area {identifier}", areaIdentifier);
            return RepositoryResult<IReadOnlyCollection<AreaTrailPathProjection>>.Error();
        }
    }

    public async Task<RepositoryResult<BoundaryPreviewProjection>> PreviewBoundaryAsync(string areaIdentifier, MultiPolygon boundary, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var area = await FindAreaAsync(context, areaIdentifier, ctoken);

            if (area is null)
                return RepositoryResult<BoundaryPreviewProjection>.NotFound();

            var changes = await PlanAreaAsync(context, area.Id, boundary, ctoken);
            var removedTrails = changes.Trails.Removed.Select(row => (int)row[TrailKey]).ToList();
            var removedFacilities = changes.Facilities.Removed.Select(row => (int)row[FacilityKey]).ToList();
            var trailIds = changes.Trails.Added.Concat(removedTrails).ToList();
            var facilityIds = changes.Facilities.Added.Concat(removedFacilities).ToList();

            var trailRows = await context.Trails
                .AsNoTracking()
                .Where(t => trailIds.Contains(t.Id))
                .OrderBy(t => t.Name)
                .Select(t => new { t.Id, t.Identifier, t.Name, t.GeoPath })
                .ToListAsync(ctoken);
            var facilityRows = await context.Facilities
                .AsNoTracking()
                .Where(f => facilityIds.Contains(f.Id))
                .OrderBy(f => f.Name)
                .Select(f => new { f.Id, f.Identifier, f.Name, f.Coordinates })
                .ToListAsync(ctoken);

            List<PreviewTrailProjection> Trails(IReadOnlyCollection<int> ids)
            {
                return [.. trailRows
                    .Where(t => ids.Contains(t.Id))
                    .Select(t => t.GeoPath is { } path
                        ? new PreviewTrailProjection(t.Identifier, t.Name, path, CityAreaMembership.TrailShare(boundary, path))
                        : null)
                    .OfType<PreviewTrailProjection>()];
            }

            List<PreviewFacilityProjection> Facilities(IReadOnlyCollection<int> ids)
            {
                return [.. facilityRows
                    .Where(f => ids.Contains(f.Id))
                    .Select(f => f.Coordinates is { } point ? new PreviewFacilityProjection(f.Identifier, f.Name, point) : null)
                    .OfType<PreviewFacilityProjection>()];
            }

            return RepositoryResult<BoundaryPreviewProjection>.Success(new BoundaryPreviewProjection(
                Trails(changes.Trails.Added),
                Trails(removedTrails),
                Facilities(changes.Facilities.Added),
                Facilities(removedFacilities)));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "CityAreaRepository: PreviewBoundaryAsync -> Something went wrong for city area {identifier}", areaIdentifier);
            return RepositoryResult<BoundaryPreviewProjection>.Error();
        }
    }

    public async Task<RepositoryResult> SaveBoundaryAsync(string areaIdentifier, MultiPolygon? boundary, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var area = await context.CityAreas.FirstOrDefaultAsync(a => a.Identifier == areaIdentifier, ctoken);

            if (area is null)
                return RepositoryResult.NotFound();

            area.Boundary = boundary;
            area.LastUpdatedAt = DateTime.UtcNow;

            await RecalculateAreaAsync(context, area.Id, boundary, ctoken);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "CityAreaRepository: SaveBoundaryAsync -> Something went wrong when saving the boundary of city area {identifier}", areaIdentifier);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult> SetMunicipalityAsync(string areaIdentifier, string? municipalityIdentifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var area = await context.CityAreas.FirstOrDefaultAsync(a => a.Identifier == areaIdentifier, ctoken);

            if (area is null)
                return RepositoryResult.NotFound();

            int? municipalityId = null;

            if (municipalityIdentifier is not null)
            {
                municipalityId = await context.Municipalities
                    .Where(m => m.Identifier == municipalityIdentifier)
                    .Select(m => (int?)m.Id)
                    .FirstOrDefaultAsync(ctoken);

                if (municipalityId is null)
                    return RepositoryResult.NotFound();
            }

            area.MunicipalityId = municipalityId;
            area.LastUpdatedAt = DateTime.UtcNow;
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "CityAreaRepository: SetMunicipalityAsync -> Something went wrong when setting the municipality of city area {identifier}", areaIdentifier);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult> RecalculateTrailsAsync(IReadOnlyCollection<int> trailIds, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var trails = await Counted(context.Trails.AsNoTracking())
                .Where(t => trailIds.Contains(t.Id))
                .Select(t => new { t.Id, t.GeoPath })
                .ToListAsync(ctoken);
            var ids = trails.Select(t => t.Id).ToList();
            var areas = await BoundedAreasAsync(context, ctoken);
            var excluded = (await context.CityAreaTrailExclusions
                .Where(e => ids.Contains(e.TrailId))
                .Select(e => new { e.TrailId, e.CityAreaId })
                .ToListAsync(ctoken))
                .ToLookup(e => e.TrailId, e => e.CityAreaId);

            var wanted = trails.ToDictionary(
                t => t.Id,
                t => t.GeoPath is { } path
                    ? areas
                        .Where(a => a.Boundary.EnvelopeInternal.Intersects(path.EnvelopeInternal)
                            && CityAreaMembership.Includes(a.Boundary, path))
                        .Select(a => a.Id)
                        .Except(excluded[t.Id])
                        .ToHashSet()
                    : []);

            await SyncItemLinksAsync(context, TrailLinkTable, TrailKey, wanted, areas.Select(a => a.Id).ToHashSet(), ctoken);
            await context.SaveChangesAsync(ctoken);
            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "CityAreaRepository: RecalculateTrailsAsync -> Something went wrong when recalculating the areas of {count} trails", trailIds.Count);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult> RecalculateFacilitiesAsync(IReadOnlyCollection<int> facilityIds, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var facilities = await context.Facilities
                .AsNoTracking()
                .Where(f => facilityIds.Contains(f.Id) && f.Coordinates != null)
                .Select(f => new { f.Id, f.Coordinates })
                .ToListAsync(ctoken);
            var ids = facilities.Select(f => f.Id).ToList();
            var areas = await BoundedAreasAsync(context, ctoken);
            var excluded = (await context.CityAreaFacilityExclusions
                .Where(e => ids.Contains(e.FacilityId))
                .Select(e => new { e.FacilityId, e.CityAreaId })
                .ToListAsync(ctoken))
                .ToLookup(e => e.FacilityId, e => e.CityAreaId);

            var wanted = facilities.ToDictionary(
                f => f.Id,
                f => f.Coordinates is { } point
                    ? areas
                        .Where(a => CityAreaMembership.Includes(a.Boundary, point))
                        .Select(a => a.Id)
                        .Except(excluded[f.Id])
                        .ToHashSet()
                    : []);

            await SyncItemLinksAsync(context, FacilityLinkTable, FacilityKey, wanted, areas.Select(a => a.Id).ToHashSet(), ctoken);
            await context.SaveChangesAsync(ctoken);
            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "CityAreaRepository: RecalculateFacilitiesAsync -> Something went wrong when recalculating the areas of {count} facilities", facilityIds.Count);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult<int>> RecalculateAllAsync(CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var areas = await context.CityAreas
                .AsNoTracking()
                .Where(a => a.Boundary != null)
                .Select(a => new { a.Id, a.Boundary })
                .ToListAsync(ctoken);

            foreach (var area in areas)
                await RecalculateAreaAsync(context, area.Id, area.Boundary, ctoken);

            await context.SaveChangesAsync(ctoken);
            return RepositoryResult<int>.Success(areas.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "CityAreaRepository: RecalculateAllAsync -> Something went wrong when recalculating every city area.");
            return RepositoryResult<int>.Error();
        }
    }

    private static IQueryable<Trail> LinkedTrails(StigViddDbContext context, int areaId)
    {
        return from link in context.Set<Dictionary<string, object>>(TrailLinkTable)
               join trail in context.Trails.AsNoTracking() on EF.Property<int>(link, TrailKey) equals trail.Id
               where EF.Property<int>(link, AreaKey) == areaId
               select trail;
    }

    // keep-comment: the trails a boundary can take in; a contribution never counts
    private static IQueryable<Trail> Counted(IQueryable<Trail> trails)
    {
        return trails.Where(t => t.Contribution == null && t.GeoPath != null);
    }

    private sealed record FoundArea(int Id, MultiPolygon? Boundary);

    // keep-comment: a trail or facility to link; IsInside is the membership rule for its kind
    private sealed record FoundItem(int Id, Func<MultiPolygon, bool> IsInside);

    // keep-comment: what differs between linking a facility and a trail: its join table, its exclusion entity and how it is found
    private sealed record LinkKind(
        string Name,
        string Table,
        string Key,
        Type ExclusionType,
        Func<int, int, object> NewExclusion,
        Func<StigViddDbContext, string, CancellationToken, Task<FoundItem?>> FindItem);

    private static readonly LinkKind FacilityLinks = new(
        "facility",
        FacilityLinkTable,
        FacilityKey,
        typeof(CityAreaFacilityExclusion),
        (areaId, facilityId) => new CityAreaFacilityExclusion { CityAreaId = areaId, FacilityId = facilityId },
        FindFacilityAsync);

    private static readonly LinkKind TrailLinks = new(
        "trail",
        TrailLinkTable,
        TrailKey,
        typeof(CityAreaTrailExclusion),
        (areaId, trailId) => new CityAreaTrailExclusion { CityAreaId = areaId, TrailId = trailId },
        FindTrailAsync);

    private static async Task<FoundArea?> FindAreaAsync(StigViddDbContext context, string identifier, CancellationToken ctoken)
    {
        return await context.CityAreas
            .AsNoTracking()
            .Where(a => a.Identifier == identifier)
            .Select(a => new FoundArea(a.Id, a.Boundary))
            .FirstOrDefaultAsync(ctoken);
    }

    // keep-comment: a contribution has no counted path, so a boundary never takes it in
    private static async Task<FoundItem?> FindTrailAsync(StigViddDbContext context, string identifier, CancellationToken ctoken)
    {
        var trail = await context.Trails
            .AsNoTracking()
            .Where(t => t.Identifier == identifier)
            .Select(t => new { t.Id, CountedPath = t.Contribution == null ? t.GeoPath : null })
            .FirstOrDefaultAsync(ctoken);

        return trail is null
            ? null
            : new FoundItem(trail.Id, boundary => trail.CountedPath is { } path && CityAreaMembership.Includes(boundary, path));
    }

    private static async Task<FoundItem?> FindFacilityAsync(StigViddDbContext context, string identifier, CancellationToken ctoken)
    {
        var facility = await context.Facilities
            .AsNoTracking()
            .Where(f => f.Identifier == identifier)
            .Select(f => new { f.Id, f.Coordinates })
            .FirstOrDefaultAsync(ctoken);

        return facility is null
            ? null
            : new FoundItem(facility.Id, boundary => facility.Coordinates is { } point && CityAreaMembership.Includes(boundary, point));
    }

    // keep-comment: no boundary means nothing lies inside, so only manual links and links to places without a position stay
    private static async Task RecalculateAreaAsync(StigViddDbContext context, int areaId, MultiPolygon? boundary, CancellationToken ctoken)
    {
        var changes = await PlanAreaAsync(context, areaId, boundary, ctoken);

        ApplyLinkChanges(context, TrailLinkTable, TrailKey, areaId, changes.Trails);
        ApplyLinkChanges(context, FacilityLinkTable, FacilityKey, areaId, changes.Facilities);
    }

    private sealed record LinkChanges(IReadOnlyList<Dictionary<string, object>> Removed, IReadOnlyList<int> Added);

    private sealed record AreaChanges(LinkChanges Trails, LinkChanges Facilities);

    private static async Task<AreaChanges> PlanAreaAsync(StigViddDbContext context, int areaId, MultiPolygon? boundary, CancellationToken ctoken)
    {
        var wantedTrails = new HashSet<int>();
        var wantedFacilities = new HashSet<int>();

        if (boundary is not null)
        {
            var trails = await Counted(context.Trails.AsNoTracking())
                .Where(t => t.GeoPath != null && t.GeoPath.Intersects(boundary))
                .Select(t => new { t.Id, t.GeoPath })
                .ToListAsync(ctoken);
            var excludedTrails = await context.CityAreaTrailExclusions
                .Where(e => e.CityAreaId == areaId)
                .Select(e => e.TrailId)
                .ToListAsync(ctoken);

            wantedTrails = trails
                .Where(t => t.GeoPath is { } path && CityAreaMembership.Includes(boundary, path))
                .Select(t => t.Id)
                .Except(excludedTrails)
                .ToHashSet();

            var facilities = await context.Facilities
                .AsNoTracking()
                .Where(f => f.Coordinates != null && boundary.Intersects(f.Coordinates))
                .Select(f => f.Id)
                .ToListAsync(ctoken);
            var excludedFacilities = await context.CityAreaFacilityExclusions
                .Where(e => e.CityAreaId == areaId)
                .Select(e => e.FacilityId)
                .ToListAsync(ctoken);

            wantedFacilities = facilities.Except(excludedFacilities).ToHashSet();
        }

        var trailChanges = await PlanLinksAsync(context, TrailLinkTable, TrailKey, areaId, wantedTrails,
            Counted(context.Trails).Select(t => t.Id), ctoken);
        var facilityChanges = await PlanLinksAsync(context, FacilityLinkTable, FacilityKey, areaId, wantedFacilities,
            context.Facilities.Where(f => f.Coordinates != null).Select(f => f.Id), ctoken);

        return new AreaChanges(trailChanges, facilityChanges);
    }

    // keep-comment: the boundary links to replace; manual links and links to places without a position are left alone
    private static async Task<LinkChanges> PlanLinksAsync(
        StigViddDbContext context,
        string table,
        string otherKey,
        int areaId,
        HashSet<int> wanted,
        IQueryable<int> positioned,
        CancellationToken ctoken)
    {
        var rows = await context.Set<Dictionary<string, object>>(table)
            .Where(l => EF.Property<int>(l, AreaKey) == areaId)
            .ToListAsync(ctoken);
        var linkedIds = rows.Select(r => (int)r[otherKey]).ToList();
        var positionedIds = (await positioned.Where(id => linkedIds.Contains(id)).ToListAsync(ctoken)).ToHashSet();

        var removed = rows
            .Where(row => !(bool)row[ManualKey] && positionedIds.Contains((int)row[otherKey]) && !wanted.Contains((int)row[otherKey]))
            .ToList();

        return new LinkChanges(removed, [.. wanted.Except(linkedIds)]);
    }

    private static void ApplyLinkChanges(StigViddDbContext context, string table, string otherKey, int areaId, LinkChanges changes)
    {
        var links = context.Set<Dictionary<string, object>>(table);
        links.RemoveRange(changes.Removed);

        foreach (var id in changes.Added)
            links.Add(NewLink(otherKey, areaId, id, manual: false));
    }

    private sealed record BoundedArea(int Id, MultiPolygon Boundary);

    // keep-comment: every boundary at once; there are a few hundred at most, and per-place queries made an import thousands of round trips
    private static async Task<List<BoundedArea>> BoundedAreasAsync(StigViddDbContext context, CancellationToken ctoken)
    {
        var areas = await context.CityAreas
            .AsNoTracking()
            .Where(a => a.Boundary != null)
            .Select(a => new { a.Id, a.Boundary })
            .ToListAsync(ctoken);

        return areas
            .Select(a => a.Boundary is { } boundary ? new BoundedArea(a.Id, boundary) : null)
            .OfType<BoundedArea>()
            .ToList();
    }

    // keep-comment: replaces each place's boundary links; areas without a boundary keep what they have
    private static async Task SyncItemLinksAsync(
        StigViddDbContext context,
        string table,
        string otherKey,
        Dictionary<int, HashSet<int>> wantedByItem,
        HashSet<int> boundedAreas,
        CancellationToken ctoken)
    {
        var ids = wantedByItem.Keys.ToList();
        var links = context.Set<Dictionary<string, object>>(table);
        var rows = (await links.Where(l => ids.Contains(EF.Property<int>(l, otherKey))).ToListAsync(ctoken))
            .ToLookup(r => (int)r[otherKey]);

        foreach (var (otherId, wantedAreas) in wantedByItem)
        {
            var linkedAreas = rows[otherId].Select(r => (int)r[AreaKey]).ToList();

            foreach (var row in rows[otherId])
            {
                var areaId = (int)row[AreaKey];

                if (!(bool)row[ManualKey] && boundedAreas.Contains(areaId) && !wantedAreas.Contains(areaId))
                    links.Remove(row);
            }

            foreach (var areaId in wantedAreas.Except(linkedAreas))
                links.Add(NewLink(otherKey, areaId, otherId, manual: false));
        }
    }

    private static async Task SetManualLinkAsync(
        StigViddDbContext context, string table, string otherKey, int areaId, int otherId, CancellationToken ctoken)
    {
        var links = context.Set<Dictionary<string, object>>(table);
        var existing = await FindLinkAsync(links, otherKey, areaId, otherId, ctoken);

        if (existing is null)
            links.Add(NewLink(otherKey, areaId, otherId, manual: true));
        else
            existing[ManualKey] = true;
    }

    private static async Task AddLinkAsync(
        StigViddDbContext context, string table, string otherKey, int areaId, int otherId, CancellationToken ctoken)
    {
        var links = context.Set<Dictionary<string, object>>(table);

        if (await FindLinkAsync(links, otherKey, areaId, otherId, ctoken) is null)
            links.Add(NewLink(otherKey, areaId, otherId, manual: false));
    }

    private static async Task RemoveLinkAsync(
        StigViddDbContext context, string table, string otherKey, int areaId, int otherId, CancellationToken ctoken)
    {
        var links = context.Set<Dictionary<string, object>>(table);

        if (await FindLinkAsync(links, otherKey, areaId, otherId, ctoken) is { } existing)
            links.Remove(existing);
    }

    private static async Task<Dictionary<string, object>?> FindLinkAsync(
        DbSet<Dictionary<string, object>> links, string otherKey, int areaId, int otherId, CancellationToken ctoken)
    {
        return await links.FirstOrDefaultAsync(
            l => EF.Property<int>(l, AreaKey) == areaId && EF.Property<int>(l, otherKey) == otherId,
            ctoken);
    }

    private static Dictionary<string, object> NewLink(string otherKey, int areaId, int otherId, bool manual)
    {
        return new Dictionary<string, object> { [AreaKey] = areaId, [otherKey] = otherId, [ManualKey] = manual };
    }
}
