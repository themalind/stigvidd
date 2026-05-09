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
            Coordinates = "[{\"latitude\":57.62,\"longitude\":12.80}]",
            CreatedBy = "user-id"
        };

        // Act
        var result = factory.Create(hike);

        // Assert
        result.Identifier.Should().Be("hike-id");
        result.Name.Should().Be("Test Hike");
        result.HikeLength.Should().Be(12.5M);
        result.Duration.Should().Be(3600000);
        result.Coordinates.Should().Be("[{\"latitude\":57.62,\"longitude\":12.80}]");
        result.CreatedBy.Should().Be("user-id");
    }
}
