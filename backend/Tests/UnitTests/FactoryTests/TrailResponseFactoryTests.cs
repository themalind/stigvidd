using Core.Factories;
using FluentAssertions;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Configuration;
using Moq;

namespace UnitTests.FactoryTests;

public class TrailResponseFactoryTests
{
    private static TrailResponseFactory BuildFactory()
    {
        var cfg = new Mock<IConfiguration>();
        cfg.Setup(c => c["PresentableBaseUrl"]).Returns("http://stigvidd.se/testing/");
        return new TrailResponseFactory(cfg.Object);
    }

    private static Trail BaseTrail() => new()
    {
        Id = 1,
        Identifier = "test-trail-id",
        Name = "Test Trail",
        TrailLength = 5.0M,
        Classification = 2,
        Accessibility = false,
        IsVerified = true,
        City = "TestCity",
        CreatedAt = DateTime.UtcNow,
        LastUpdatedAt = DateTime.UtcNow,
        TrailImages = []
    };

    [Fact]
    public void Create_WhenTrailHasVisitorInformation_MapsAllFields()
    {
        // Arrange
        var factory = BuildFactory();
        var trail = BaseTrail();
        trail.VisitorInformation = new VisitorInformation
        {
            Identifier = "vi-identifier-1",
            GettingThere = "Drive north",
            PublicTransport = "Bus 12",
            Parking = "Free parking",
            Illumination = true,
            IlluminationText = "Lit until 22:00",
            MaintainedBy = "Municipality",
            WinterMaintenance = true
        };

        // Act
        var result = factory.Create(trail);

        // Assert
        result.VisitorInformation.Should().NotBeNull();
        result.VisitorInformation.Identifier.Should().Be("vi-identifier-1");
        result.VisitorInformation.GettingThere.Should().Be("Drive north");
        result.VisitorInformation.PublicTransport.Should().Be("Bus 12");
        result.VisitorInformation.Parking.Should().Be("Free parking");
        result.VisitorInformation.Illumination.Should().BeTrue();
        result.VisitorInformation.IlluminationText.Should().Be("Lit until 22:00");
        result.VisitorInformation.MaintainedBy.Should().Be("Municipality");
        result.VisitorInformation.WinterMaintenance.Should().BeTrue();
    }

    [Fact]
    public void Create_WhenTrailHasNoVisitorInformation_ReturnsNullVisitorInformation()
    {
        // Arrange
        var factory = BuildFactory();
        var trail = BaseTrail();
        trail.VisitorInformation = null;

        // Act
        var result = factory.Create(trail);

        // Assert
        result.VisitorInformation.Should().BeNull();
    }

    [Fact]
    public void Create_WhenTrailHasImages_ImageUrlsHaveBaseUrlPrepended()
    {
        // Arrange
        var factory = BuildFactory();
        var trail = BaseTrail();
        trail.TrailImages =
        [
            new TrailImage { Identifier = "img-1", ImageUrl = "trails/img1.jpg", TrailId = 1 },
            new TrailImage { Identifier = "img-2", ImageUrl = "trails/img2.jpg", TrailId = 1 }
        ];

        // Act
        var result = factory.Create(trail);

        // Assert
        result.TrailImagesResponse.Should().HaveCount(2);
        result.TrailImagesResponse.Should().NotBeNull();
        result.TrailImagesResponse.Should().AllSatisfy(img =>
            img.ImageUrl.Should().StartWith("http://stigvidd.se/testing/"));
        result.TrailImagesResponse.Select(i => i.ImageUrl).Should().BeEquivalentTo(
            ["http://stigvidd.se/testing/trails/img1.jpg", "http://stigvidd.se/testing/trails/img2.jpg"]);
    }

    [Fact]
    public void Create_WhenTrailHasNoImages_ReturnsEmptyImages()
    {
        // Arrange
        var factory = BuildFactory();
        var trail = BaseTrail();
        trail.TrailImages = [];

        // Act
        var result = factory.Create(trail);

        // Assert
        result.TrailImagesResponse.Should().BeEmpty();
    }
}
