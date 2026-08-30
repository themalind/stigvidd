// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using StigviddAPI;

namespace IntegrationTests.SpatialSchema;

/// <summary>
/// Proves the SRID is pinned on the COLUMN, not merely on the objects the seeds build. The
/// unit tests assert <c>.SRID</c> on an entity before save, which says nothing about the
/// schema; only SpatiaLite can answer that, because it enforces the declared SRID on insert
/// in both directions — a 4326 value into an SRID-0 column is rejected just as hard as the
/// reverse. So a read-back of 4326 here means the model really did pin the column, and if
/// StigViddDbContext ever loses a <c>Sqlite:Srid</c> annotation the seed fails outright.
///
/// It cannot prove the other half of the story: SpatiaLite silently computes ST_Distance
/// across mismatched SRIDs where PostGIS raises, so the mixed-SRID query failure in
/// TrailRepository is provable only against real PostGIS under docker compose.
/// </summary>
public class GeometrySridIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    public GeometrySridIntegrationTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    private StigViddDbContext NewContext()
    {
        using var scope = _factory.Services.CreateScope();
        return scope.ServiceProvider
            .GetRequiredService<IDbContextFactory<StigViddDbContext>>()
            .CreateDbContext();
    }

    [Fact]
    public async Task EveryStoredGeometry_ShouldComeBackAtWgs84()
    {
        // Arrange
        using var context = NewContext();
        var ct = TestContext.Current.CancellationToken;

        // Act
        var trailPath = (await context.Trails.AsNoTracking()
            .FirstAsync(t => t.GeoPath != null, ct)).GeoPath!;
        var hikePath = (await context.Hikes.AsNoTracking().FirstAsync(ct)).GeoPath;
        var facilityPoint = (await context.Facilities.AsNoTracking()
            .FirstAsync(f => f.Coordinates != null, ct)).Coordinates!;

        // Assert
        trailPath.SRID.Should().Be(GeoPointFactory.Wgs84Srid);
        hikePath.SRID.Should().Be(GeoPointFactory.Wgs84Srid);
        facilityPoint.SRID.Should().Be(GeoPointFactory.Wgs84Srid);
    }

    [Fact]
    public async Task AnEmptyPath_ShouldSurviveTheRoundTripAtWgs84()
    {
        // Arrange — the hike seeds use Utilities.GeoPath() with no arguments, which is an
        // EMPTY LineString. SpatiaLite takes one into a LINESTRING/4326 column because the
        // SRID sits in the blob header independently of the point count; this pins that,
        // so a provider version that regresses it fails here rather than somewhere baffling.
        using var context = NewContext();
        var ct = TestContext.Current.CancellationToken;

        // Act — materialised, then inspected client-side: ST_IsEmpty is not the thing under
        // test, the round trip is.
        var hike = await context.Hikes.AsNoTracking().FirstAsync(ct);

        // Assert
        hike.GeoPath.NumPoints.Should().Be(0, "the hike seeds are built by Utilities.GeoPath() with no points");
        hike.GeoPath.IsEmpty.Should().BeTrue();
        hike.GeoPath.SRID.Should().Be(GeoPointFactory.Wgs84Srid);
    }
}
