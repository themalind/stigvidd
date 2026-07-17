using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace MapData;

/// <summary>
/// Imports Borås city areas (and their fishing / swimming / nature-reserve facilities) from
/// areas.json, the curated source of truth for area metadata. Edit that file by hand to add or
/// change areas.
///
/// Scope (per decision 2026-07-11): only the areas themselves and the three owned facility types are
/// imported. Firepits/shelters and trails already sit in the DB and are intentionally left untouched.
///
/// The importer is idempotent and non-destructive: areas are upserted by name, and the
/// fishing/swimming/nature facilities are upserted by name too — an existing row keeps its Id,
/// Identifier, CreatedAt and current links; only its fields are refreshed, its type flags are OR-ed
/// in (never cleared), and missing area links are added. Nothing is deleted. A row is only matched
/// and updated when it already carries one of the three owned flags, so a pure firepit/shelter that
/// happens to share a name is left completely alone.
/// </summary>
internal class CityAreaImporter
{
    private readonly StigViddDbContext _stigViddDbContext;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public CityAreaImporter(StigViddDbContext stigViddDbContext)
    {
        _stigViddDbContext = stigViddDbContext;
    }

    public async Task ImportAsync(string areasJsonPath, CancellationToken ctoken)
    {
        var json = await File.ReadAllTextAsync(areasJsonPath, ctoken);
        var areas = JsonSerializer.Deserialize<List<AreaJson>>(json, JsonOptions)
            ?? throw new InvalidOperationException($"Could not parse areas from '{areasJsonPath}'.");

        await UpsertAreasAsync(areas, ctoken);
        await ImportAreaFacilitiesAsync(areas, ctoken);
    }

    private async Task UpsertAreasAsync(List<AreaJson> areas, CancellationToken ctoken)
    {
        // Match on Name (the natural key in areas.json). Identifier is a BaseEntity-generated GUID
        // and is never taken from the JSON slug.
        var existing = await _stigViddDbContext.CityAreas.ToDictionaryAsync(a => a.Name, ctoken);

        var added = 0;
        var updated = 0;
        foreach (var area in areas)
        {
            if (existing.TryGetValue(area.Name, out var entity))
            {
                entity.Location = area.Location;
                entity.Description = area.Description;
                entity.ImageUrl = area.ImageUrl;
                entity.Url = area.Url;
                entity.LastUpdatedAt = DateTime.UtcNow;
                updated++;
            }
            else
            {
                _stigViddDbContext.CityAreas.Add(new CityArea
                {
                    Name = area.Name,
                    Location = area.Location,
                    Description = area.Description,
                    ImageUrl = area.ImageUrl,
                    Url = area.Url,
                    CreatedAt = DateTime.UtcNow,
                    LastUpdatedAt = DateTime.UtcNow,
                });
                added++;
            }
        }

        await _stigViddDbContext.SaveChangesAsync(ctoken);
        Console.WriteLine($"CityAreas: {added} added, {updated} updated ({areas.Count} total).");
    }

    private async Task ImportAreaFacilitiesAsync(List<AreaJson> areas, CancellationToken ctoken)
    {
        var areaEntities = await _stigViddDbContext.CityAreas.ToDictionaryAsync(a => a.Name, ctoken);

        // Dedupe facilities by name across the three types, collecting every area each appears under.
        // The Facility built here is only used verbatim when the name is new to the DB; for an
        // existing row we copy these fields onto it instead (see upsert loop below).
        var byName = new Dictionary<string, (Facility Facility, HashSet<string> AreaNames)>(StringComparer.OrdinalIgnoreCase);

        foreach (var area in areas)
        {
            foreach (var listing in area.Facilities)
            {
                var facilityType = MapFacilityType(listing.Type);
                if (facilityType == FacilityType.None)
                {
                    Console.WriteLine($"  ! Unknown facility type '{listing.Type}' for '{listing.Name}' — skipped.");
                    continue;
                }

                var key = listing.Name.Trim();
                if (!byName.TryGetValue(key, out var entry))
                {
                    entry = (new Facility
                    {
                        Identifier = Guid.NewGuid().ToString(),
                        Name = key,
                        FacilityType = facilityType,
                        IsAccessible = false,
                        Latitude = null,
                        Longitude = null,
                        Location = listing.Location,
                        Description = listing.Description,
                        Url = listing.Url,
                        CityAreas = new List<CityArea>(),
                        CreatedAt = DateTime.UtcNow,
                        LastUpdatedAt = DateTime.UtcNow,
                    }, new HashSet<string>());
                    byName[key] = entry;
                }
                else if (!entry.Facility.FacilityType.HasFlag(facilityType))
                {
                    // Same name listed under a different type — combine the flags rather than drop one.
                    entry.Facility.FacilityType |= facilityType;
                    Console.WriteLine($"  ~ '{key}' appears under multiple types; combined to {entry.Facility.FacilityType}.");
                }

                entry.AreaNames.Add(area.Name);
            }
        }

        // Load existing rows for exactly the names we're importing, with their current links. Only
        // rows that already carry one of the three owned flags are treated as ours; a pure
        // firepit/shelter sharing a name is deliberately excluded so it is never touched.
        var importNames = byName.Keys.ToList();
        var existingByName = (await _stigViddDbContext.Facilities
                .Include(f => f.CityAreas)
                .Where(f => importNames.Contains(f.Name))
                .ToListAsync(ctoken))
            .Where(f => f.FacilityType.HasFlag(FacilityType.FishingArea)
                     || f.FacilityType.HasFlag(FacilityType.SwimmingArea)
                     || f.FacilityType.HasFlag(FacilityType.NatureReserve))
            .GroupBy(f => f.Name, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

        var added = 0;
        var updated = 0;
        var links = 0;
        foreach (var (name, entry) in byName)
        {
            var desired = entry.Facility;

            Facility facility;
            if (existingByName.TryGetValue(name, out var existing))
            {
                // Combine flags (never clear — keeps any FirePit/Shelter bit intact) and refresh fields.
                existing.FacilityType |= desired.FacilityType;
                existing.Location = desired.Location;
                existing.Description = desired.Description;
                existing.Url = desired.Url;
                existing.LastUpdatedAt = DateTime.UtcNow;
                existing.CityAreas ??= new List<CityArea>();
                facility = existing;
                updated++;
            }
            else
            {
                facility = desired;
                facility.CityAreas ??= new List<CityArea>();
                _stigViddDbContext.Facilities.Add(facility);
                added++;
            }

            foreach (var areaName in entry.AreaNames)
            {
                if (!areaEntities.TryGetValue(areaName, out var areaEntity))
                {
                    Console.WriteLine($"  ! Area '{areaName}' not found for facility '{facility.Name}'.");
                    continue;
                }

                // Add the link only if it isn't already present (match by Id; new areas have a real Id
                // here because UpsertAreasAsync saved before this method ran).
                if (facility.CityAreas!.All(a => a.Id != areaEntity.Id))
                {
                    facility.CityAreas.Add(areaEntity);
                    links++;
                }
            }
        }

        await _stigViddDbContext.SaveChangesAsync(ctoken);
        Console.WriteLine($"Facilities: {added} added, {updated} updated ({byName.Count} total); {links} new area links.");
    }

    private static FacilityType MapFacilityType(string type) => type.Trim().ToLowerInvariant() switch
    {
        "fishingarea" => FacilityType.FishingArea,
        "swimmingarea" => FacilityType.SwimmingArea,
        "naturereserv" => FacilityType.NatureReserve,
        _ => FacilityType.None,
    };

    private sealed record AreaJson(
        string Identifier,
        string Name,
        string Location,
        string? Description,
        string? ImageUrl,
        string? Url,
        List<AreaFacilityJson> Facilities);

    private sealed record AreaFacilityJson(
        string Name,
        string? Location,
        string? Description,
        string? Url,
        string Type);
}
