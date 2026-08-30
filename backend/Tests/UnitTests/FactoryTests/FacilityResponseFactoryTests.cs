// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Factories;
using AwesomeAssertions;
using Infrastructure.Data.Entities;

namespace UnitTests.FactoryTests;

public class FacilityResponseFactoryTests
{
    private static FacilityResponseFactory BuildFactory() => new();

    private static Facility BaseFacility() => new()
    {
        Identifier = "facility-id",
        Name = "Test Firepit",
        FacilityType = FacilityType.FirePit,
        IsAccessible = true,
        Coordinates = GeoPointFactory.FromLonLat(12.80, 57.62),
        Location = "Söder om Borås",
        Description = "En trevlig grillplats vid sjön.",
        Url = "https://boras.se/grillplats"
    };

    [Fact]
    public void Create_Single_MapsAllFieldsCorrectly()
    {
        // Arrange
        var factory = BuildFactory();

        // Act
        var result = factory.Create(BaseFacility());

        // Assert
        result.Identifier.Should().Be("facility-id");
        result.Name.Should().Be("Test Firepit");
        result.FacilityType.Should().Be((int)FacilityType.FirePit);
        result.IsAccessible.Should().BeTrue();
        result.Latitude.Should().Be(57.62M);
        result.Longitude.Should().Be(12.80M);
        result.Location.Should().Be("Söder om Borås");
        result.Description.Should().Be("En trevlig grillplats vid sjön.");
        result.Url.Should().Be("https://boras.se/grillplats");
    }

    [Fact]
    public void Create_Single_WhenOptionalFieldsNull_MapsThemAsNull()
    {
        // Arrange
        var factory = BuildFactory();
        var facility = BaseFacility();
        facility.Location = null;
        facility.Description = null;
        facility.Url = null;

        // Act
        var result = factory.Create(facility);

        // Assert
        result.Location.Should().BeNull();
        result.Description.Should().BeNull();
        result.Url.Should().BeNull();
    }

    [Fact]
    public void Create_Single_WhenCoordinatesNull_CoercesToZero()
    {
        // Arrange — coordinate-less facilities (fishing/swimming/nature) are projected via GetValueOrDefault().
        var factory = BuildFactory();
        var facility = BaseFacility();
        facility.Coordinates = null;

        // Act
        var result = factory.Create(facility);

        // Assert
        result.Latitude.Should().Be(0M);
        result.Longitude.Should().Be(0M);
    }

    [Fact]
    public void Create_Collection_MapsAllItems()
    {
        // Arrange
        var factory = BuildFactory();
        var facilities = new List<Facility>
        {
            BaseFacility(),
            new() { Identifier = "facility-2", Name = "Shelter", FacilityType = FacilityType.Shelter, IsAccessible = false, Coordinates = GeoPointFactory.FromLonLat(13.0, 58.0) }
        };

        // Act
        var result = factory.Create(facilities);

        // Assert
        result.Should().HaveCount(2);
        result.Should().Contain(f => f.Identifier == "facility-id");
        result.Should().Contain(f => f.Identifier == "facility-2");
    }
}
