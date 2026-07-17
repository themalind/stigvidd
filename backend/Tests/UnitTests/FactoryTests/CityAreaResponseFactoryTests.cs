using Core.Factories;
using Core.Services;
using FluentAssertions;
using Infrastructure.Enums;
using Microsoft.Extensions.Configuration;
using Moq;

namespace UnitTests.FactoryTests;

public class CityAreaResponseFactoryTests
{
    private static CityAreaResponseFactory BuildFactory()
    {
        var cfg = new Mock<IConfiguration>();
        cfg.Setup(c => c["PresentableBaseUrl"]).Returns("http://stigvidd.se/testing/");

        return new CityAreaResponseFactory(cfg.Object);
    }

    private static CityAreaProjection AreaWithLinks() => new(
        "area-dalsjofors",
        "Dalsjöfors",
        "Öster om Borås",
        "Ett friluftsområde.",
        "https://stigvidd.se/area.jpg",
        "https://www.boras.se/dalsjofors",
        Facilities:
        [
            new CityAreaFacilityProjection("fac-firepit", "Grillplats Tiveden", (int)FacilityType.FirePit, true, null, null, null),
            new CityAreaFacilityProjection("fac-fishing", "Ankedammen", (int)FacilityType.FishingArea, false, "Dalsjöfors", null, null)
        ],
        Trails:
        [
            new CityAreaTrailProjection(
                "trail-tiveden", "Tiveden", 9.5M, 2, "En vandringsled genom skogen.",
                4.5M, new CityAreaTrailImageProjection("img-tiveden", "tiveden.jpg"))
        ]);

    [Fact]
    public void Create_Single_MapsAllFieldsFacilitiesAndTrails()
    {
        // Arrange
        var factory = BuildFactory();

        // Act
        var result = factory.Create(AreaWithLinks());

        // Assert
        result.Identifier.Should().Be("area-dalsjofors");
        result.Name.Should().Be("Dalsjöfors");
        result.Location.Should().Be("Öster om Borås");
        result.Description.Should().Be("Ett friluftsområde.");
        result.ImageUrl.Should().Be("https://stigvidd.se/area.jpg");
        result.Url.Should().Be("https://www.boras.se/dalsjofors");

        result.Facilities.Should().HaveCount(2);
        result.Facilities.Should().Contain(f => f.Identifier == "fac-firepit" && f.FacilityType == (int)FacilityType.FirePit);
        result.Facilities.Should().Contain(f => f.Identifier == "fac-fishing" && f.FacilityType == (int)FacilityType.FishingArea);

        result.Trails.Should().ContainSingle(t =>
            t.Identifier == "trail-tiveden" &&
            t.Name == "Tiveden" &&
            t.TrailLength == 9.5M &&
            t.Classification == 2 &&
            t.Description == "En vandringsled genom skogen." &&
            t.AverageRating == 4.5M &&
            t.Image!.Identifier == "img-tiveden" &&
            t.Image.ImageUrl == "http://stigvidd.se/testing/tiveden.jpg");
    }

    [Fact]
    public void Create_Single_WhenCollectionsAreEmpty_ReturnsEmptyCollections()
    {
        // Arrange — area not linked to anything
        var factory = BuildFactory();
        var area = new CityAreaProjection(
            "area-viskafors", "Viskafors", "Söder om Borås", null, null, null, [], []);

        // Act
        var result = factory.Create(area);

        // Assert
        result.Facilities.Should().NotBeNull().And.BeEmpty();
        result.Trails.Should().NotBeNull().And.BeEmpty();
    }

    [Fact]
    public void Create_Collection_MapsAllItems()
    {
        // Arrange
        var factory = BuildFactory();
        var areas = new List<CityAreaProjection>
        {
            AreaWithLinks(),
            new("area-viskafors", "Viskafors", "Söder om Borås", null, null, null, [], [])
        };

        // Act
        var result = factory.Create(areas);

        // Assert
        result.Should().HaveCount(2);
        result.Should().Contain(a => a.Identifier == "area-dalsjofors");
        result.Should().Contain(a => a.Identifier == "area-viskafors");
    }
}
