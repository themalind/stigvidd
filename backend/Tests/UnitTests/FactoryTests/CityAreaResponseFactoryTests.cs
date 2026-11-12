// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Services;
using AwesomeAssertions;
using Infrastructure.Enums;
using Microsoft.Extensions.Configuration;
using Moq;
using NetTopologySuite.Geometries;
using WebDataContracts.Enums;

namespace UnitTests.FactoryTests;

public class CityAreaResponseFactoryTests
{
    private static CityAreaResponseFactory BuildFactory()
    {
        var cfg = new Mock<IConfiguration>();
        cfg.Setup(c => c["PresentableBaseUrl"]).Returns("http://stigvidd.se/testing/");

        return new CityAreaResponseFactory(cfg.Object);
    }

    private static CityAreaProjection AreaWithLinks()
    {
        return new(
        "area-dalsjofors",
        "Dalsjöfors",
        "Öster om Borås",
        "Ett friluftsområde.",
        "https://stigvidd.se/area.jpg",
        "https://www.boras.se/dalsjofors",
        "Borås",
        Square,
        Facilities:
        [
            new CityAreaFacilityProjection(
                "fac-firepit", "Grillplats Tiveden", (int)FacilityType.FirePit, true, null, null, null, GeoPointFactory.FromLonLat(12.95, 57.71)),
            new CityAreaFacilityProjection("fac-fishing", "Ankedammen", (int)FacilityType.FishingArea, false, "Dalsjöfors", null, null, null)
        ],
        Trails:
        [
            new CityAreaTrailProjection(
                "trail-tiveden", "Tiveden", 9.5M, 2, "En vandringsled genom skogen.",
                4.5M, new CityAreaTrailImageProjection("img-tiveden", "tiveden.jpg"),
                GeoPointFactory.FromLonLatPath([new Coordinate(12.9, 57.7), new Coordinate(12.91, 57.71)]))
        ]);
    }

    private static readonly MultiPolygon Square = GeoPointFactory.FromLonLatPolygons(
    [
        [[new Coordinate(12.9, 57.7), new Coordinate(13.0, 57.7), new Coordinate(13.0, 57.8), new Coordinate(12.9, 57.7)]]
    ]);

    [Fact]
    public void Create_Single_MapsAllFieldsFacilitiesAndTrails()
    {
        // Arrange
        var factory = BuildFactory();

        // Act
        var result = factory.Create(AreaWithLinks(), null, includeShapes: false);

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
            "area-viskafors", "Viskafors", "Söder om Borås", null, null, null, null, null, [], []);

        // Act
        var result = factory.Create(area, null, includeShapes: true);

        // Assert
        result.Facilities.Should().NotBeNull().And.BeEmpty();
        result.Trails.Should().NotBeNull().And.BeEmpty();
        result.Boundary.Should().BeNull();
    }

    [Fact]
    public void Create_ForTheList_LeavesTheShapesOutButKeepsMunicipalityDistanceAndPositions()
    {
        // Act
        var result = BuildFactory().Create(AreaWithLinks(), 2.345, includeShapes: false);

        // Assert
        result.Municipality.Should().Be("Borås");
        result.DistanceKm.Should().Be(2.3);
        result.Boundary.Should().BeNull();
        result.Trails.Should().ContainSingle().Which.Path.Should().BeNull();
        var firePit = result.Facilities.Single(f => f.Identifier == "fac-firepit");
        firePit.Latitude.Should().Be(57.71M);
        firePit.Longitude.Should().Be(12.95M);
        result.Facilities.Single(f => f.Identifier == "fac-fishing").Latitude.Should().BeNull();
    }

    [Fact]
    public void Create_ForOneArea_IncludesTheBoundaryAndTrailPaths()
    {
        // Act
        var result = BuildFactory().Create(AreaWithLinks(), null, includeShapes: true);

        // Assert
        result.DistanceKm.Should().BeNull();
        var boundary = result.Boundary;
        boundary.Should().NotBeNull();
        if (boundary is null) throw new InvalidOperationException("expected a boundary");
        boundary.Should().ContainSingle().Which.Should().ContainSingle().Which.Should().HaveCount(4);
        var path = result.Trails.Should().ContainSingle().Subject.Path;
        if (path is null) throw new InvalidOperationException("expected a path");
        path.Should().HaveCount(2);
        path[0].Should().Equal(12.9, 57.7);
    }

    [Fact]
    public void CreateLinkSuggestions_MapsEveryFieldAndRoundsTheDistance()
    {
        // Arrange
        var factory = BuildFactory();
        var near = new AreaSuggestion("area-rya", "Rya åsar", AreaSuggestionReason.Nearby, 1.4321, "Ryaslingan");
        var named = new AreaSuggestion("area-rya", "Rya åsar", AreaSuggestionReason.Name, null, null);

        // Act
        var result = factory.CreateLinkSuggestions(
            [
                new SuggestedFacility(new UnlinkedFacilityProjection("fac-near", "Grillplats", (int)FacilityType.FirePit, 57.70, 12.90), [near]),
                new SuggestedFacility(new UnlinkedFacilityProjection("fac-far", "Fiskevatten", (int)FacilityType.FishingArea, null, null), []),
            ],
            [new SuggestedTrail(new UnlinkedTrailProjection("trail-rya", "Rya åsar runt", "Borås", false, null, null), [named])]);

        // Assert
        var facility = result.Facilities.Single(f => f.Identifier == "fac-near");
        facility.Name.Should().Be("Grillplats");
        facility.FacilityType.Should().Be((int)FacilityType.FirePit);
        var suggestion = facility.Suggestions.Should().ContainSingle().Subject;
        suggestion.AreaIdentifier.Should().Be("area-rya");
        suggestion.AreaName.Should().Be("Rya åsar");
        suggestion.Reason.Should().Be(AreaSuggestionReason.Nearby);
        suggestion.DistanceKm.Should().Be(1.4);
        suggestion.NearestName.Should().Be("Ryaslingan");
        result.Facilities.Single(f => f.Identifier == "fac-far").Suggestions.Should().BeEmpty();
        var trail = result.Trails.Should().ContainSingle().Subject;
        trail.Name.Should().Be("Rya åsar runt");
        trail.City.Should().Be("Borås");
        trail.IsVerified.Should().BeFalse();
        trail.Suggestions.Should().ContainSingle().Which.DistanceKm.Should().BeNull();
    }
}
