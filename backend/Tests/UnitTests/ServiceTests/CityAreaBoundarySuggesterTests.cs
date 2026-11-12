// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Repositories.CityAreas;
using Core.Services.CityAreas;
using Core.Spatial;
using NetTopologySuite.Geometries;

namespace UnitTests.ServiceTests;

public class CityAreaBoundarySuggesterTests
{
    // keep-comment: at 57.7° N one metre is about 1/111 000 of a degree of latitude and 1/59 500 of longitude
    private const double Latitude = 57.70;
    private const double Longitude = 12.90;
    private const double DegreesPerMetreNorth = 1 / 111_300.0;
    private const double DegreesPerMetreEast = 1 / 59_600.0;

    private static Point PointAt(double metresEast, double metresNorth)
    {
        return GeoPointFactory.FromLonLat(Longitude + (metresEast * DegreesPerMetreEast), Latitude + (metresNorth * DegreesPerMetreNorth));
    }

    private static LineString EastwardTrail(double metresNorth, double lengthMetres)
    {
        return GeoPointFactory.FromLonLatPath([PointAt(0, metresNorth).Coordinate, PointAt(lengthMetres, metresNorth).Coordinate]);
    }

    [Fact]
    public void Suggest_WithNothingToGoOn_ReturnsNull()
    {
        // Act
        var suggestion = CityAreaBoundarySuggester.Suggest([], []);

        // Assert
        (suggestion is null).Should().BeTrue();
    }

    [Fact]
    public void Suggest_TakesInEveryLinkedTrailAndPlace()
    {
        // Arrange
        var trail = EastwardTrail(0, 2000);
        var place = PointAt(1000, 1500);

        // Act
        var suggestion = CityAreaBoundarySuggester.Suggest([trail], [place]);

        // Assert
        if (suggestion is null) throw new InvalidOperationException("expected a suggestion");
        suggestion.IsValid.Should().BeTrue();
        suggestion.SRID.Should().Be(GeoPointFactory.Wgs84Srid);
        PathMetrics.ShareInside(trail, suggestion).Should().BeApproximately(1.0, 0.001);
        CityAreaMembership.Includes(suggestion, place).Should().BeTrue();
    }

    [Fact]
    public void Suggest_KeepsABandOfBufferMetresAroundATrail()
    {
        // Arrange
        var trail = EastwardTrail(0, 2000);

        // Act
        var suggestion = CityAreaBoundarySuggester.Suggest([trail], []);

        // Assert
        if (suggestion is null) throw new InvalidOperationException("expected a suggestion");
        suggestion.Intersects(PointAt(1000, CityAreaBoundarySuggester.BufferMetres - 50)).Should().BeTrue();
        suggestion.Intersects(PointAt(1000, CityAreaBoundarySuggester.BufferMetres + 50)).Should().BeFalse();
    }

    [Fact]
    public void Suggest_FillsTheGapBetweenNearbyTrails()
    {
        // Arrange
        var south = EastwardTrail(0, 2000);
        var north = EastwardTrail(1000, 2000);

        // Act
        var suggestion = CityAreaBoundarySuggester.Suggest([south, north], []);

        // Assert
        if (suggestion is null) throw new InvalidOperationException("expected a suggestion");
        suggestion.NumGeometries.Should().Be(1);
        suggestion.Intersects(PointAt(1000, 500)).Should().BeTrue();
    }

    [Fact]
    public void Suggest_KeepsFarApartTrailsAsSeparateParts()
    {
        // Arrange
        var south = EastwardTrail(0, 2000);
        var north = EastwardTrail(5000, 2000);

        // Act
        var suggestion = CityAreaBoundarySuggester.Suggest([south, north], []);

        // Assert
        if (suggestion is null) throw new InvalidOperationException("expected a suggestion");
        suggestion.NumGeometries.Should().Be(2);
        suggestion.Intersects(PointAt(1000, 2500)).Should().BeFalse();
    }
}
