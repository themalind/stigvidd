using FluentAssertions;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using MapData;
using Microsoft.EntityFrameworkCore;

namespace UnitTests.ImporterTests;

public class CityAreaImporterTests
{
    // Each test uses an isolated in-memory database (shared by name across context instances so a
    // fresh context sees what the importer saved).
    private static StigViddDbContext NewContext(string dbName) =>
        new(new DbContextOptionsBuilder<StigViddDbContext>()
            .UseInMemoryDatabase(dbName)
            .Options);

    // Writes JSON to a temp file, runs the action with its path, and always deletes it afterwards.
    private static async Task WithAreasJsonAsync(string json, Func<string, Task> action)
    {
        var path = Path.Combine(Path.GetTempPath(), $"areas-{Guid.NewGuid()}.json");
        await File.WriteAllTextAsync(path, json, CancellationToken.None);
        try
        {
            await action(path);
        }
        finally
        {
            if (File.Exists(path))
                File.Delete(path);
        }
    }

    private const string SingleFishingAreaJson = """
    [
      {
        "identifier": "slug-testomrade",
        "name": "Testområde",
        "location": "Öster om Borås",
        "description": "En beskrivning",
        "imageUrl": null,
        "url": "https://example.com/omrade",
        "facilities": [
          { "name": "Fiskesjön", "location": "Vid vattnet", "description": "Fint fiske", "url": null, "type": "fishingarea" }
        ]
      }
    ]
    """;

    [Fact]
    public async Task ImportAsync_AddsAreaAndOwnedFacilityLinkedTogether()
    {
        var dbName = Guid.NewGuid().ToString();

        await WithAreasJsonAsync(SingleFishingAreaJson, async path =>
        {
            using var context = NewContext(dbName);
            context.Database.EnsureCreated();

            await new CityAreaImporter(context).ImportAsync(path, CancellationToken.None);
        });

        using var verify = NewContext(dbName);
        var area = await verify.CityAreas.Include(a => a.Facilities).SingleAsync(CancellationToken.None);
        area.Name.Should().Be("Testområde");
        area.Location.Should().Be("Öster om Borås");
        area.Facilities.Should().ContainSingle(f => f.Name == "Fiskesjön");

        var facility = await verify.Facilities.SingleAsync(CancellationToken.None);
        facility.FacilityType.Should().Be(FacilityType.FishingArea);
        facility.Location.Should().Be("Vid vattnet");
        // Owned facilities are coordinate-less; they surface via the area, not the map endpoint.
        facility.Latitude.Should().BeNull();
        facility.Longitude.Should().BeNull();
    }

    [Fact]
    public async Task ImportAsync_IsIdempotent_RunningTwiceDoesNotDuplicate()
    {
        var dbName = Guid.NewGuid().ToString();

        await WithAreasJsonAsync(SingleFishingAreaJson, async path =>
        {
            using (var first = NewContext(dbName))
            {
                first.Database.EnsureCreated();
                await new CityAreaImporter(first).ImportAsync(path, CancellationToken.None);
            }

            using var second = NewContext(dbName);
            await new CityAreaImporter(second).ImportAsync(path, CancellationToken.None);
        });

        using var verify = NewContext(dbName);
        (await verify.CityAreas.CountAsync(CancellationToken.None)).Should().Be(1);
        (await verify.Facilities.CountAsync(CancellationToken.None)).Should().Be(1);

        // Still exactly one area link, not duplicated.
        var facility = await verify.Facilities.Include(f => f.CityAreas).SingleAsync(CancellationToken.None);
        facility.CityAreas.Should().ContainSingle();
    }

    [Fact]
    public async Task ImportAsync_WhenOwnedFacilityAlreadyExists_CombinesTypeFlags()
    {
        var dbName = Guid.NewGuid().ToString();

        // Pre-seed an owned (FishingArea) facility that the JSON also lists as a swimming area.
        using (var seed = NewContext(dbName))
        {
            seed.Database.EnsureCreated();
            seed.Facilities.Add(new Facility
            {
                Identifier = Guid.NewGuid().ToString(),
                Name = "Delade Sjön",
                FacilityType = FacilityType.FishingArea,
                CreatedAt = DateTime.UtcNow,
                LastUpdatedAt = DateTime.UtcNow
            });
            await seed.SaveChangesAsync(CancellationToken.None);
        }

        var json = """
        [
          {
            "identifier": "slug-delade",
            "name": "Delade Området",
            "location": "Söder",
            "facilities": [
              { "name": "Delade Sjön", "type": "swimmingarea" }
            ]
          }
        ]
        """;

        await WithAreasJsonAsync(json, async path =>
        {
            using var context = NewContext(dbName);
            await new CityAreaImporter(context).ImportAsync(path, CancellationToken.None);
        });

        using var verify = NewContext(dbName);
        var facilities = await verify.Facilities.Where(f => f.Name == "Delade Sjön").ToListAsync(CancellationToken.None);
        facilities.Should().ContainSingle();
        // Flags are OR-ed, never cleared.
        facilities[0].FacilityType.Should().Be(FacilityType.FishingArea | FacilityType.SwimmingArea);
    }

    [Fact]
    public async Task ImportAsync_LeavesPureFirePitSharingAName_Untouched()
    {
        var dbName = Guid.NewGuid().ToString();

        // A pure firepit (not one of the three owned types) that happens to share a name.
        using (var seed = NewContext(dbName))
        {
            seed.Database.EnsureCreated();
            seed.Facilities.Add(new Facility
            {
                Identifier = Guid.NewGuid().ToString(),
                Name = "Grillplatsen",
                FacilityType = FacilityType.FirePit,
                Latitude = 57.7M,
                Longitude = 12.9M,
                CreatedAt = DateTime.UtcNow,
                LastUpdatedAt = DateTime.UtcNow
            });
            await seed.SaveChangesAsync(CancellationToken.None);
        }

        var json = """
        [
          {
            "identifier": "slug-grill",
            "name": "Grillområdet",
            "location": "Norr",
            "facilities": [
              { "name": "Grillplatsen", "type": "fishingarea" }
            ]
          }
        ]
        """;

        await WithAreasJsonAsync(json, async path =>
        {
            using var context = NewContext(dbName);
            await new CityAreaImporter(context).ImportAsync(path, CancellationToken.None);
        });

        using var verify = NewContext(dbName);
        // The original firepit row must remain exactly a firepit — never merged into.
        var firePit = await verify.Facilities.SingleAsync(f => f.FacilityType == FacilityType.FirePit, CancellationToken.None);
        firePit.Name.Should().Be("Grillplatsen");
        firePit.Latitude.Should().Be(57.7M);
    }

    [Fact]
    public async Task ImportAsync_SkipsFacilityWithUnknownType()
    {
        var dbName = Guid.NewGuid().ToString();

        var json = """
        [
          {
            "identifier": "slug-unknown",
            "name": "Okänt Område",
            "location": "Väster",
            "facilities": [
              { "name": "Lekplatsen", "type": "playground" }
            ]
          }
        ]
        """;

        await WithAreasJsonAsync(json, async path =>
        {
            using var context = NewContext(dbName);
            context.Database.EnsureCreated();
            await new CityAreaImporter(context).ImportAsync(path, CancellationToken.None);
        });

        using var verify = NewContext(dbName);
        // The area is still created, but the unknown-type facility is skipped.
        (await verify.CityAreas.CountAsync(CancellationToken.None)).Should().Be(1);
        (await verify.Facilities.CountAsync(CancellationToken.None)).Should().Be(0);
    }
}
