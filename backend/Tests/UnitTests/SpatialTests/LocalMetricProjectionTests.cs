// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using NetTopologySuite.Geometries;

namespace UnitTests.SpatialTests;

/// <summary>
/// The projection is what lets the matcher speak in metres. If its scale is wrong the
/// 15 m tolerance silently becomes something else, and every coverage figure with it.
/// </summary>
public class LocalMetricProjectionTests
{
    private static readonly Envelope Boras = new(12.80, 12.95, 57.65, 57.75);

    [Fact]
    public void Project_ForTheCentreOfTheArea_ShouldReturnTheOrigin()
    {
        // Arrange
        var projection = LocalMetricProjection.CentredOn(Boras);

        // Act
        var origin = projection.Project(new Coordinate(12.875, 57.70));

        // Assert
        origin.X.Should().BeApproximately(0, 0.001);
        origin.Y.Should().BeApproximately(0, 0.001);
    }

    [Fact]
    public void Project_ForOneDegreeOfLatitude_ShouldBeAboutOneHundredAndElevenKilometres()
    {
        // Arrange
        var projection = LocalMetricProjection.CentredOn(Boras);

        // Act
        var north = projection.Project(new Coordinate(12.875, 58.70));

        // Assert — the meridian arc at 57.7 degrees.
        north.Y.Should().BeApproximately(111372, 100);
    }

    [Fact]
    public void Project_ForOneDegreeOfLongitude_ShouldShrinkWithTheLatitude()
    {
        // Arrange — at 57.7 degrees a degree of longitude is little more than half of one
        // of latitude, which is the whole reason a flat degree grid cannot be used.
        var projection = LocalMetricProjection.CentredOn(Boras);

        // Act
        var east = projection.Project(new Coordinate(13.875, 57.70));

        // Assert
        east.X.Should().BeApproximately(59630, 100);
    }

    [Fact]
    public void Project_ForAShortDistance_ShouldAgreeWithTheGeodesicLength()
    {
        // Arrange — the same segment measured against PostGIS, which is what the database
        // itself would say.
        var from = new Coordinate(12.8446637, 57.6702168);
        var to = new Coordinate(12.8603287, 57.6844817);
        var projection = LocalMetricProjection.CentredOn(Boras);

        // PostGIS: ST_Length(...::geography) on this segment. The ellipsoidal figure,
        // not the spherical 1839,405 m that a haversine returns.
        const double ellipsoidal = 1843.241;

        // Act
        var planar = projection.Project(from).Distance(projection.Project(to));

        // Assert — under a metre apart on a 1,8 km segment.
        planar.Should().BeApproximately(ellipsoidal, 1.0);
    }

    [Fact]
    public void CentredOn_ForAnEmptyEnvelope_ShouldThrow()
    {
        // Act
        var act = () => LocalMetricProjection.CentredOn(new Envelope());

        // Assert
        act.Should().Throw<ArgumentException>();
    }

}
