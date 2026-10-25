// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;

namespace UnitTests.SpatialTests;

public class Sweref99TmProjectionTests
{
    [Fact]
    public void ToWgs84_OnTheCentralMeridian_ShouldReturnFifteenDegreesEastAtAnyNorthing()
    {
        // Act
        var (longitude, _) = Sweref99TmProjection.ToWgs84(500000, 6600000);

        // Assert
        longitude.Should().BeApproximately(15.0, 0.0000001);
    }

    [Fact]
    public void ToWgs84_ForAPointInJamtland_ShouldMatchItsKnownLatLon()
    {
        // Arrange — Vålådalen, taken from naturvardsverket-Statliga_Leder.geojson.
        const double easting = 392726.4338;
        const double northing = 7001831.936;

        // Act
        var (longitude, latitude) = Sweref99TmProjection.ToWgs84(easting, northing);

        // Assert
        latitude.Should().BeApproximately(63.1298, 0.001);
        longitude.Should().BeApproximately(12.8724, 0.001);
    }

    [Fact]
    public void ToWgs84_ForAPointNearVanern_ShouldMatchItsKnownLatLon()
    {
        // Arrange — the Kilsviken nature reserve, taken from naturvardsverket-Leder.geojson.
        const double easting = 447821.3609;
        const double northing = 6553994.0473;

        // Act
        var (longitude, latitude) = Sweref99TmProjection.ToWgs84(easting, northing);

        // Assert
        latitude.Should().BeApproximately(59.1220, 0.001);
        longitude.Should().BeApproximately(14.0885, 0.001);
    }
}
