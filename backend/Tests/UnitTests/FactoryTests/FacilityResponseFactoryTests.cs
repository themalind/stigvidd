using Core.Factories;
using FluentAssertions;
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
        Latitude = 57.62M,
        Longitude = 12.80M,
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
        facility.Latitude = null;
        facility.Longitude = null;

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
            new() { Identifier = "facility-2", Name = "Shelter", FacilityType = FacilityType.Shelter, IsAccessible = false, Latitude = 58.0M, Longitude = 13.0M }
        };

        // Act
        var result = factory.Create(facilities);

        // Assert
        result.Should().HaveCount(2);
        result.Should().Contain(f => f.Identifier == "facility-id");
        result.Should().Contain(f => f.Identifier == "facility-2");
    }
}
