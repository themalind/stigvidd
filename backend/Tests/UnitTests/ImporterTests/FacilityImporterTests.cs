using FluentAssertions;
using Infrastructure.Data;
using MapData;
using Microsoft.EntityFrameworkCore;

namespace UnitTests.ImporterTests;

public class FacilityImporterTests
{
    private static StigViddDbContext NewContext(string dbName) =>
        new(new DbContextOptionsBuilder<StigViddDbContext>()
            .UseInMemoryDatabase(dbName)
            .Options);

    // Writes CSV to a temp file, runs the action with its path, and always deletes it afterwards.
    private static async Task WithCsvAsync(string csv, Func<string, Task> action)
    {
        var path = Path.Combine(Path.GetTempPath(), $"facilities-{Guid.NewGuid()}.csv");
        await File.WriteAllTextAsync(path, csv, CancellationToken.None);
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

    private const string Header = "typ,namn,tillganglighet,lat,lng";

    private static async Task<StigViddDbContext> ImportAsync(string dbName, string csvBody)
    {
        var csv = $"{Header}\n{csvBody}\n";
        await WithCsvAsync(csv, async path =>
        {
            using var context = NewContext(dbName);
            context.Database.EnsureCreated();
            await new FacilityImporter(context).ImportAsync(path, CancellationToken.None);
        });
        return NewContext(dbName);
    }

    [Fact]
    public async Task ImportAsync_MapsGrillplatsToFirePitWithCoordinates()
    {
        var dbName = Guid.NewGuid().ToString();

        using var verify = await ImportAsync(dbName, "Grillplats,Grillplats Tiveden,,58.9,14.5");

        var facility = await verify.Facilities.SingleAsync(CancellationToken.None);
        facility.Name.Should().Be("Grillplats Tiveden");
        facility.FacilityType.Should().Be(FacilityType.FirePit);
        facility.Latitude.Should().Be(58.9M);
        facility.Longitude.Should().Be(14.5M);
        facility.IsAccessible.Should().BeFalse();
    }

    [Fact]
    public async Task ImportAsync_MapsVindskyddAndAccessibilityFlag()
    {
        var dbName = Guid.NewGuid().ToString();

        using var verify = await ImportAsync(dbName, "Vindskydd,Vindskydd Gesebol,Tillgänglighetsanpassad,58.1,13.9");

        var facility = await verify.Facilities.SingleAsync(CancellationToken.None);
        facility.FacilityType.Should().Be(FacilityType.Shelter);
        facility.IsAccessible.Should().BeTrue();
    }

    [Fact]
    public async Task ImportAsync_WhenNameBlank_UsesFacilityTypeDisplayName()
    {
        var dbName = Guid.NewGuid().ToString();

        using var verify = await ImportAsync(dbName, "Grillplats,,,57.0,12.0");

        var facility = await verify.Facilities.SingleAsync(CancellationToken.None);
        facility.Name.Should().Be("Grillplats");
    }

    [Fact]
    public async Task ImportAsync_WhenNameSaysGrillplatsOchVindskydd_CombinesFlags()
    {
        var dbName = Guid.NewGuid().ToString();

        using var verify = await ImportAsync(dbName, "Grillplats,Stora grillplats och vindskydd,,57.5,13.5");

        var facility = await verify.Facilities.SingleAsync(CancellationToken.None);
        facility.FacilityType.Should().Be(FacilityType.FirePit | FacilityType.Shelter);
    }

    [Fact]
    public async Task ImportAsync_MapsUnknownTypeToNone()
    {
        var dbName = Guid.NewGuid().ToString();

        using var verify = await ImportAsync(dbName, "Bänk,Sittbänk,,57.5,13.5");

        var facility = await verify.Facilities.SingleAsync(CancellationToken.None);
        facility.FacilityType.Should().Be(FacilityType.None);
    }
}
