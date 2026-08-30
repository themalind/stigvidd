// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Infrastructure.Data;
using MapData;
using Microsoft.EntityFrameworkCore;

namespace UnitTests.ImporterTests;

// The only coverage this importer has. It is the fourth site that builds a persisted
// LineString, and until MapData/Program.cs was wired up nothing invoked it at all, so a
// regression here would otherwise reach the database before anything noticed.
public class TransmogrifyBorasDataTests
{
    private static StigViddDbContext NewContext(string dbName) =>
        new(new DbContextOptionsBuilder<StigViddDbContext>()
            .UseInMemoryDatabase(dbName)
            .Options);

    // Writes GeoJSON to a temp file, runs the importer against it, and always cleans up.
    private static async Task<StigViddDbContext> ImportAsync(string dbName, string geoJson)
    {
        var path = Path.Combine(Path.GetTempPath(), $"trails-{Guid.NewGuid()}.json");
        await File.WriteAllTextAsync(path, geoJson, CancellationToken.None);
        try
        {
            using var context = NewContext(dbName);
            context.Database.EnsureCreated();
            await new TransmogrifyBorasData(context).TransmogrifyAsync(path, CancellationToken.None);
        }
        finally
        {
            if (File.Exists(path))
                File.Delete(path);
        }

        return NewContext(dbName);
    }

    // Coordinates are GeoJSON order, [longitude, latitude].
    private static string Feature(string name, string coordinates) => $$"""
    {
      "type": "FeatureCollection",
      "features": [
        {
          "type": "Feature",
          "properties": { "namn": "{{name}}", "sparlangd": "2 km", "link": "-" },
          "geometry": { "type": "LineString", "coordinates": {{coordinates}} }
        }
      ]
    }
    """;

    [Fact]
    public async Task TransmogrifyAsync_ShouldBuildThePathAtWgs84()
    {
        // Arrange & Act
        using var context = await ImportAsync(
            nameof(TransmogrifyAsync_ShouldBuildThePathAtWgs84),
            Feature("Knalleleden", "[[12.805, 57.621], [12.806, 57.622]]"));

        // Assert — SRID 4326, not NetTopologySuite's default of 0. The column is
        // geometry(LineString, 4326) under PostGIS, which refuses anything else.
        var trail = await context.Trails.SingleAsync(TestContext.Current.CancellationToken);
        trail.GeoPath.Should().NotBeNull();
        trail.GeoPath!.SRID.Should().Be(GeoPointFactory.Wgs84Srid);

        // And the order is (X = longitude, Y = latitude) — reversing it lands in the Gulf of Guinea.
        trail.GeoPath.StartPoint.X.Should().BeApproximately(12.805, 1e-9);
        trail.GeoPath.StartPoint.Y.Should().BeApproximately(57.621, 1e-9);
    }

    [Fact]
    public async Task TransmogrifyAsync_ForASinglePointGeometry_ShouldKeepTheTrailWithoutAPath()
    {
        // Arrange & Act — NetTopologySuite throws on exactly one point, which used to abort
        // the whole import mid-loop. Trail.GeoPath is nullable, so the trail survives.
        using var context = await ImportAsync(
            nameof(TransmogrifyAsync_ForASinglePointGeometry_ShouldKeepTheTrailWithoutAPath),
            Feature("Enpunktsleden", "[[12.805, 57.621]]"));

        // Assert
        var trail = await context.Trails.SingleAsync(TestContext.Current.CancellationToken);
        trail.Name.Should().Be("Enpunktsleden");
        trail.GeoPath.Should().BeNull();
    }
}
