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
        Longitude = 12.80M
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
