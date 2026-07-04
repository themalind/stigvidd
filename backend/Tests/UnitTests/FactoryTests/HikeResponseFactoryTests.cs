using Core.Factories;
using FluentAssertions;
using Infrastructure.Data.Entities;

namespace UnitTests.FactoryTests;

public class HikeResponseFactoryTests
{
    private static HikeResponseFactory BuildFactory() => new();

    [Fact]
    public void Create_MapsAllFieldsCorrectly()
    {
        // Arrange
        var factory = BuildFactory();
        var hike = new Hike
        {
            Identifier = "hike-id",
            Name = "Test Hike",
            HikeLength = 12.5M,
            Duration = 3600000,
            GeoPath = UnitTests.Utilities.GeoPath((12.81, 57.62), (12.83, 57.64)),
            CreatedBy = "user-id",
            GettingThere = "Take the E20 west",
            ParkingInfo = "Free parking at trailhead",
            Description = "A great hike"
        };

        // Act
        var result = factory.Create(hike);

        // Assert
        result.Identifier.Should().Be("hike-id");
        result.Name.Should().Be("Test Hike");
        result.HikeLength.Should().Be(12.5M);
        result.Duration.Should().Be(3600000);
        result.Coordinates.Should().Be("[{\"latitude\":57.62,\"longitude\":12.81},{\"latitude\":57.64,\"longitude\":12.83}]");
        result.CreatedBy.Should().Be("user-id");
        result.GettingThere.Should().Be("Take the E20 west");
        result.ParkingInfo.Should().Be("Free parking at trailhead");
        result.Description.Should().Be("A great hike");
    }

    [Fact]
    public void Create_WhenOptionalFieldsAreNull_MapsNulls()
    {
        // Arrange
        var factory = BuildFactory();
        var hike = new Hike
        {
            Identifier = "hike-id",
            Name = "Test Hike",
            HikeLength = 12.5M,
            Duration = 3600000,
            GeoPath = UnitTests.Utilities.GeoPath(),
            CreatedBy = "user-id",
            GettingThere = null,
            ParkingInfo = null,
            Description = null
        };

        // Act
        var result = factory.Create(hike);

        // Assert
        result.GettingThere.Should().BeNull();
        result.ParkingInfo.Should().BeNull();
        result.Description.Should().BeNull();
    }
}
