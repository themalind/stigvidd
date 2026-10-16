// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Services;
using Core.Spatial;

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

        var trimmed = HikeSubmissionService.Trim(path, 1, 3);

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

        HikeSubmissionService.Trim(path, start, end).Should().BeNull();
    }

    [Fact]
    public void Trim_WithoutIndexesKeepsThePath()
    {
        var path = Utilities.GeoPath((1, 1), (2, 2), (3, 3));

        var trimmed = HikeSubmissionService.Trim(path, null, null);

        trimmed.Should().NotBeNull();
        trimmed.NumPoints.Should().Be(3);
    }
}
