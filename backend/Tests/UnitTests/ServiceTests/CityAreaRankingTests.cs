// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Services;
using NetTopologySuite.Geometries;

namespace UnitTests.ServiceTests;

public class CityAreaRankingTests
{
    private static MultiPolygon SquareAt(double longitude, double latitude)
    {
        const double side = 0.01;
        return GeoPointFactory.FromLonLatPolygons(
        [
            [[
                new Coordinate(longitude, latitude),
                new Coordinate(longitude + side, latitude),
                new Coordinate(longitude + side, latitude + side),
                new Coordinate(longitude, latitude + side),
                new Coordinate(longitude, latitude),
            ]]
        ]);
    }

    private static CityAreaProjection Area(string name, MultiPolygon? boundary, params decimal[] ratings)
    {
        return new(
            name, name, "", null, null, null, null, boundary, [],
            [.. ratings.Select(rating => new CityAreaTrailProjection(name + rating, "", 1, 1, null, rating, null, false, null))]);
    }

    [Fact]
    public void Order_WithAPosition_PutsTheNearestBoundaryFirstAndAreasWithoutOneLast()
    {
        // Arrange
        var user = new Coordinate(12.94, 57.72);
        var far = Area("Långt bort", SquareAt(13.2, 57.72), 5);
        var near = Area("Nära", SquareAt(12.95, 57.72));
        var none = Area("Utan yta", null, 5);

        // Act
        var ordered = CityAreaRanking.Order([none, far, near], user);

        // Assert
        ordered.Select(r => r.Area.Name).Should().Equal("Nära", "Långt bort", "Utan yta");
        ordered[0].DistanceKm.Should().BeApproximately(0.6, 0.05);
        ordered[2].DistanceKm.Should().BeNull();
    }

    [Fact]
    public void DistanceKm_IsZeroInsideTheBoundary()
    {
        // Act
        var distance = CityAreaRanking.DistanceKm(SquareAt(12.9, 57.7), new Coordinate(12.905, 57.705));

        // Assert
        distance.Should().Be(0);
    }

    [Fact]
    public void Order_WithoutAPosition_PutsTheBestRatedFirstThenByName()
    {
        // Arrange
        var unrated = Area("Önnarp", SquareAt(12.9, 57.7));
        var good = Area("Bra", null, 4, 5);
        var middling = Area("Mitt", null, 3, 0);
        var alsoUnrated = Area("Ågården", null);

        // Act
        var ordered = CityAreaRanking.Order([unrated, middling, alsoUnrated, good], null);

        // Assert
        ordered.Select(r => r.Area.Name).Should().Equal("Bra", "Mitt", "Ågården", "Önnarp");
        ordered.Should().OnlyContain(r => r.DistanceKm == null);
    }
}
