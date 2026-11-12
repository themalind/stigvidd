// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Services;
using Core.Spatial;
using NetTopologySuite.Geometries;

namespace UnitTests.SpatialTests;

public class PathMetricsTests
{
    [Fact]
    public void LongestGapMetres_FindsTheJump()
    {
        var path = Utilities.GeoPath((12.9400, 57.7200), (12.9400, 57.7201), (12.9400, 57.7202), (12.9400, 57.7302));

        PathMetrics.LongestGapMetres(path).Should().BeInRange(1100, 1125);
    }

    [Fact]
    public void LengthKm_IsTheSumOfTheSegments()
    {
        var path = Utilities.GeoPath((12.9400, 57.7200), (12.9400, 57.7290));

        PathMetrics.LengthKm(path).Should().BeInRange(0.99m, 1.01m);
    }

    private static MultiPolygon Square(double west, double south, double east, double north)
    {
        IReadOnlyList<Coordinate> ring =
            [new(west, south), new(east, south), new(east, north), new(west, north), new(west, south)];

        return GeoPointFactory.FromLonLatPolygons([[ring]]);
    }

    [Fact]
    public void ShareInside_IsOneForAPathWhollyInside_AndZeroForOneOutside()
    {
        var area = Square(12.90, 57.70, 13.00, 57.80);

        PathMetrics.ShareInside(Utilities.GeoPath((12.92, 57.72), (12.95, 57.75)), area).Should().BeApproximately(1.0, 0.0001);
        PathMetrics.ShareInside(Utilities.GeoPath((13.10, 57.72), (13.20, 57.75)), area).Should().Be(0.0);
    }

    [Fact]
    public void ShareInside_WeighsThePartsInMetresNotDegrees()
    {
        // keep-comment: 0.01° east is ~595 m here and 0.01° north ~1113 m: 595 of 2303 m inside, where degrees would say 1/3
        var area = Square(12.90, 57.70, 13.00, 57.80);
        var path = Utilities.GeoPath((12.99, 57.75), (13.01, 57.75), (13.01, 57.76));

        PathMetrics.ShareInside(path, area).Should().BeInRange(0.25, 0.27);
    }

    [Fact]
    public void CoordinatePathParser_RejectsOutOfRangeAndMalformedInput()
    {
        CoordinatePathParser.TryParse("not json").Should().BeNull();
        CoordinatePathParser.TryParse("[{\"latitude\":57.7,\"longitude\":12.9}]").Should().BeNull();
        CoordinatePathParser.TryParse("[{\"latitude\":91,\"longitude\":12.9},{\"latitude\":57.7,\"longitude\":12.9}]").Should().BeNull();
    }

    [Fact]
    public void CoordinatePathParser_BuildsAnSrid4326PathInLonLatOrder()
    {
        var path = CoordinatePathParser.TryParse("[{\"latitude\":57.7,\"longitude\":12.9},{\"latitude\":57.8,\"longitude\":13.0}]");

        path.Should().NotBeNull();
        path.SRID.Should().Be(4326);
        path.Coordinates[0].X.Should().Be(12.9);
        path.Coordinates[0].Y.Should().Be(57.7);
    }

    [Fact]
    public void Trim_KeepsTheInclusiveRange()
    {
        var path = Utilities.GeoPath((1, 1), (2, 2), (3, 3), (4, 4), (5, 5));

        var trimmed = PathTrim.Trim(path, 1, 3);

        trimmed.Should().NotBeNull();
        trimmed.Coordinates.Select(c => c.X).Should().Equal(2, 3, 4);
        trimmed.SRID.Should().Be(4326);
    }

    [Theory]
    [InlineData(-1, 3)]
    [InlineData(2, 2)]
    [InlineData(0, 5)]
    [InlineData(3, 1)]
    public void Trim_RejectsIndexesThatLeaveNoPath(int start, int end)
    {
        var path = Utilities.GeoPath((1, 1), (2, 2), (3, 3), (4, 4), (5, 5));

        PathTrim.Trim(path, start, end).Should().BeNull();
    }

    [Fact]
    public void Trim_WithoutIndexesKeepsThePath()
    {
        var path = Utilities.GeoPath((1, 1), (2, 2), (3, 3));

        var trimmed = PathTrim.Trim(path, null, null);

        trimmed.Should().NotBeNull();
        trimmed.NumPoints.Should().Be(3);
    }
}
