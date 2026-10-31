// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Services.Events;
using Core.Spatial;
using NetTopologySuite.Geometries;

namespace UnitTests.SpatialTests;

public class PathSimplifierTests
{
    private const double Latitude = 57.72;
    private const double Longitude = 12.94;
    private const double DegreesPerMetreNorth = 1 / 111_330.0;
    private const double DegreesPerMetreEast = 1 / 59_600.0;

    // A line heading north, a point every 10 m, the middle one pushed east. keep-comment: the shape every test below bends
    private static LineString NorthWithBulge(double bulgeMetres)
    {
        return Utilities.GeoPath([.. Enumerable.Range(0, 11).Select(i => (
            Longitude + (i == 5 ? bulgeMetres * DegreesPerMetreEast : 0),
            Latitude + i * 10 * DegreesPerMetreNorth))]);
    }

    [Fact]
    public void Simplify_DropsPointsWithinTheTolerance()
    {
        var simplified = PathSimplifier.Simplify(NorthWithBulge(1), toleranceMetres: 2);

        simplified.NumPoints.Should().Be(2);
    }

    [Fact]
    public void Simplify_KeepsAPointBeyondTheTolerance()
    {
        var path = NorthWithBulge(5);

        var simplified = PathSimplifier.Simplify(path, toleranceMetres: 2);

        simplified.Coordinates.Should().Contain(path.Coordinates[5]);
        simplified.Coordinates[0].Should().Be(path.Coordinates[0]);
        simplified.Coordinates[^1].Should().Be(path.Coordinates[10]);
        simplified.Coordinates.Should().OnlyContain(c => path.Coordinates.Contains(c));
    }

    [Fact]
    public void Simplify_MeasuresInMetresNotDegrees()
    {
        // 3 m east is 0.00005° but 3 m north is only 0.000027°: a degree tolerance would treat them differently. keep-comment: what this test guards
        var east = Utilities.GeoPath(
            (Longitude, Latitude),
            (Longitude + 3 * DegreesPerMetreEast, Latitude + 50 * DegreesPerMetreNorth),
            (Longitude, Latitude + 100 * DegreesPerMetreNorth));
        var north = Utilities.GeoPath(
            (Longitude, Latitude),
            (Longitude + 50 * DegreesPerMetreEast, Latitude + 3 * DegreesPerMetreNorth),
            (Longitude + 100 * DegreesPerMetreEast, Latitude));

        PathSimplifier.Simplify(east, toleranceMetres: 2).NumPoints.Should().Be(3);
        PathSimplifier.Simplify(north, toleranceMetres: 2).NumPoints.Should().Be(3);
        PathSimplifier.Simplify(east, toleranceMetres: 4).NumPoints.Should().Be(2);
        PathSimplifier.Simplify(north, toleranceMetres: 4).NumPoints.Should().Be(2);
    }

    [Fact]
    public void Simplify_KeepsSrid4326()
    {
        PathSimplifier.Simplify(NorthWithBulge(5), toleranceMetres: 2).SRID.Should().Be(4326);
    }

    [Fact]
    public void Trim_DropsHeightAndTime()
    {
        var recorded = GeoPointFactory.FromLonLatPath(
        [
            new CoordinateZM(12.94, 57.72, 150, 1_000),
            new CoordinateZM(12.95, 57.73, 160, 2_000),
            new CoordinateZM(12.96, 57.74, 170, 3_000),
        ]);

        var trimmed = PathTrim.Trim(recorded, null, null);

        trimmed.Should().NotBeNull();
        trimmed.Coordinates.Should().OnlyContain(c => double.IsNaN(c.Z) && double.IsNaN(c.M));
    }

    [Fact]
    public void EventRouteCopy_TrimsSimplifiesAndMeasures()
    {
        var copy = EventRouteCopy.FromHike(NorthWithBulge(1), trimStartIndex: 2, trimEndIndex: 8);

        copy.Value.Should().NotBeNull();
        copy.Value.Path.NumPoints.Should().Be(2);
        copy.Value.Path.Coordinates[0].Y.Should().BeApproximately(Latitude + 20 * DegreesPerMetreNorth, 1e-12);
        copy.Value.LengthMetres.Should().BeInRange(59, 61);
    }

    [Fact]
    public void EventRouteCopy_RejectsARouteThatStaysTooLong()
    {
        // Every point 10 m off the line between its neighbours, so nothing simplifies away. keep-comment: why the zigzag
        var zigzag = Utilities.GeoPath([.. Enumerable.Range(0, EventRouteCopy.MaxPoints + 1).Select(i => (
            Longitude + (i % 2) * 10 * DegreesPerMetreEast,
            Latitude + i * 10 * DegreesPerMetreNorth))]);

        var copy = EventRouteCopy.FromHike(zigzag, null, null);

        copy.Message.Should().NotBeNull();
        copy.Message.StatusCode.Should().Be(400);
    }

    [Fact]
    public void EventRouteCopy_WithIndexesThatLeaveNoPath_Is400()
    {
        var copy = EventRouteCopy.FromHike(NorthWithBulge(5), trimStartIndex: 4, trimEndIndex: 20);

        copy.Message.Should().NotBeNull();
        copy.Message.StatusCode.Should().Be(400);
    }
}
