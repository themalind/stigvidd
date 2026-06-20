using System.Linq.Expressions;
using Core;
using Core.Repositories;
using FluentAssertions;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Logging.Abstractions;
using NetTopologySuite.Geometries;

namespace UnitTests.RepositoryTests;

public class TrailRepositoryTests : TestBase
{
    private const string TivedenIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c";
    private const string StorsjoledenIdentifier = "22b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

    // A verified trail with a real GeoPath (the seed trails have none), optionally
    // carrying a single review so popularity ranking can be asserted. UserId 1 exists
    // in the standard seed.
    private static Trail VerifiedGeoTrail(string identifier, decimal? rating = null) => new()
    {
        Identifier = identifier,
        Name = identifier,
        TrailLength = 5M,
        IsVerified = true,
        City = "City",
        Coordinates = "[]",
        GeoPath = Geometry.DefaultFactory.CreateLineString(
            [new Coordinate(12.80, 57.62), new Coordinate(12.81, 57.63)]),
        Reviews = rating.HasValue
            ? [new Review { Identifier = $"rev-{identifier}", Rating = rating.Value, UserId = 1 }]
            : null,
    };

    [Fact]
    public async Task GetTrailIdByIdentifier_WhenFound_ReturnsId()
    {
        // Arrange
        var repo = new TrailRepository(CreateSeededFactory(), NullLogger<TrailRepository>.Instance);

        // Act
        var result = await repo.GetTrailIdByIdentifierAsync(TivedenIdentifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task GetTrailIdByIdentifier_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new TrailRepository(CreateSeededFactory(), NullLogger<TrailRepository>.Instance);

        // Act
        var result = await repo.GetTrailIdByIdentifierAsync("no-such-trail", CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task GetTrailByIdentifier_WhenFound_ReturnsTrail()
    {
        // Arrange
        var repo = new TrailRepository(CreateSeededFactory(), NullLogger<TrailRepository>.Instance);

        // Act
        var result = await repo.GetTrailByIdentifierAsync(TivedenIdentifier, t => t.Identifier, CancellationToken.None);

        // Assert
        // Tiveden has IsVerified = false in seed data, so it is filtered out
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task GetTrailByIdentifier_WhenVerified_ReturnsTrail()
    {
        // Arrange
        var repo = new TrailRepository(CreateSeededFactory(), NullLogger<TrailRepository>.Instance);

        // Act
        // Storsjöleden has IsVerified = true
        var result = await repo.GetTrailByIdentifierAsync(StorsjoledenIdentifier, t => t.Identifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Should().Be(StorsjoledenIdentifier);
    }

    [Fact]
    public async Task GetTrailByIdentifier_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new TrailRepository(CreateSeededFactory(), NullLogger<TrailRepository>.Instance);

        // Act
        var result = await repo.GetTrailByIdentifierAsync("no-such-trail", t => t.Identifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task GetCoordinates_WhenFound_ReturnsCoordinates()
    {
        // Arrange
        var repo = new TrailRepository(CreateSeededFactory(), NullLogger<TrailRepository>.Instance);

        // Act
        var result = await repo.GetCoordinatesByTrailIdentifierAsync(StorsjoledenIdentifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task GetCoordinates_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new TrailRepository(CreateSeededFactory(), NullLogger<TrailRepository>.Instance);

        // Act
        var result = await repo.GetCoordinatesByTrailIdentifierAsync("no-such-trail", CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task AddTrail_ShouldPersistAndReturn()
    {
        // Arrange
        var factory = CreateSeededFactory();
        var repo = new TrailRepository(factory, NullLogger<TrailRepository>.Instance);
        var trail = new Trail
        {
            Identifier = Guid.NewGuid().ToString(),
            Name = "NewTestTrail",
            TrailLength = 5.5M,
            Classification = 2,
            Accessibility = false,
            AccessibilityInfo = "Normal terrain",
            Description = "Test",
            FullDescription = string.Empty,
            TrailSymbol = "Red",
            TrailSymbolImage = "http://example.com/symbol.png",
            Coordinates = "[]",
            Tags = "[]",
            IsVerified = true,
            City = "TestCity",
            CreatedAt = DateTime.UtcNow,
            LastUpdatedAt = DateTime.UtcNow,
            TrailImages = []
        };

        // Act
        var result = await repo.AddTrailAsync(trail, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Name.Should().Be("NewTestTrail");

        var verify = await repo.GetTrailIdByIdentifierAsync(trail.Identifier, CancellationToken.None);
        verify.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task GetTrailsByIdentifiers_ReturnsMatchingVerifiedTrails()
    {
        // Arrange
        var repo = new TrailRepository(CreateSeededFactory(), NullLogger<TrailRepository>.Instance);

        // Act
        var result = await repo.GetTrailsByIdentifiersAsync(
            [Utilities.Identifiers.Trail4, Utilities.Identifiers.Trail7],
            t => t.Identifier,
            CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEquivalentTo([Utilities.Identifiers.Trail4, Utilities.Identifiers.Trail7]);
    }

    [Fact]
    public async Task GetTrailsByIdentifiers_ExcludesUnverifiedTrails()
    {
        // Arrange — Tiveden is seeded with IsVerified = false
        var repo = new TrailRepository(CreateSeededFactory(), NullLogger<TrailRepository>.Instance);

        // Act
        var result = await repo.GetTrailsByIdentifiersAsync(
            [TivedenIdentifier],
            t => t.Identifier,
            CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task GetTrailsByIdentifiers_IgnoresUnknownIdentifiers()
    {
        // Arrange
        var repo = new TrailRepository(CreateSeededFactory(), NullLogger<TrailRepository>.Instance);

        // Act
        var result = await repo.GetTrailsByIdentifiersAsync(
            [Utilities.Identifiers.Trail4, "no-such-trail"],
            t => t.Identifier,
            CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().ContainSingle().Which.Should().Be(Utilities.Identifiers.Trail4);
    }

    [Fact]
    public async Task GetTrailsByIdentifiers_WhenEmptyInput_ReturnsEmpty()
    {
        // Arrange
        var repo = new TrailRepository(CreateSeededFactory(), NullLogger<TrailRepository>.Instance);

        // Act
        var result = await repo.GetTrailsByIdentifiersAsync(
            [],
            t => t.Identifier,
            CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task GetPopularTrailOverviews_WithoutLocation_OrdersByRatingDescending()
    {
        // Arrange — only trails with a GeoPath are eligible, so seed our own
        var factory = CreateSeededFactory(ctx => ctx.Trails.AddRange(
            VerifiedGeoTrail("pop-high", 5.0M),
            VerifiedGeoTrail("pop-low", 2.0M),
            VerifiedGeoTrail("pop-mid", 4.0M)));
        var repo = new TrailRepository(factory, NullLogger<TrailRepository>.Instance);

        // Act — without a user location the score is the average rating only
        var result = await repo.GetPopularTrailOverviewsAsync(
            null, null,
            t => new { t.Identifier, Rating = t.Reviews!.Any() ? t.Reviews!.Average(r => r.Rating) : 0m },
            CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.First().Identifier.Should().Be("pop-high");
        result.Value!.Select(x => x.Rating).Should().BeInDescendingOrder();
    }

    [Fact]
    public async Task GetPopularTrailOverviews_ExcludesUnverifiedTrails()
    {
        // Arrange
        var factory = CreateSeededFactory(ctx =>
        {
            ctx.Trails.Add(VerifiedGeoTrail("pop-verified", 4.0M));
            var unverified = VerifiedGeoTrail("pop-unverified", 5.0M);
            unverified.IsVerified = false;
            ctx.Trails.Add(unverified);
        });
        var repo = new TrailRepository(factory, NullLogger<TrailRepository>.Instance);

        // Act
        var result = await repo.GetPopularTrailOverviewsAsync(
            null, null,
            t => t.Identifier,
            CancellationToken.None);

        // Assert — the unverified trail is excluded despite its higher rating
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Contain("pop-verified");
        result.Value.Should().NotContain("pop-unverified");
    }

    [Fact]
    public async Task GetPopularTrailOverviews_WithLocation_ExcludesTrailsWithoutGeoPath()
    {
        // Arrange — a verified trail without a GeoPath has no start point to rank by,
        // so it must be excluded (consistent with the markers/basic-info queries) even
        // though it has the highest rating.
        var factory = CreateSeededFactory(ctx =>
        {
            ctx.Trails.Add(VerifiedGeoTrail("pop-with-path", 3.0M));
            var noPath = VerifiedGeoTrail("pop-no-path", 5.0M);
            noPath.GeoPath = null;
            ctx.Trails.Add(noPath);
        });
        var repo = new TrailRepository(factory, NullLogger<TrailRepository>.Instance);

        // Act — a user location triggers the proximity branch (StartPoint.Distance)
        var result = await repo.GetPopularTrailOverviewsAsync(
            57.72, 12.94,
            t => t.Identifier,
            CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Contain("pop-with-path");
        result.Value.Should().NotContain("pop-no-path");
    }

    [Fact]
    public async Task GetPopularTrailOverviews_LimitsResultToTen()
    {
        // Arrange — seed enough verified trails (with GeoPath) to exceed the Take(10) cap
        var factory = CreateSeededFactory(ctx =>
        {
            for (var i = 0; i < 15; i++)
                ctx.Trails.Add(VerifiedGeoTrail($"extra-popular-{i}"));
        });
        var repo = new TrailRepository(factory, NullLogger<TrailRepository>.Instance);

        // Act
        var result = await repo.GetPopularTrailOverviewsAsync(
            null, null,
            t => t.Identifier,
            CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(10);
    }

    [Fact]
    public async Task GetAllTrailMarkers_ProjectsStartPoint_AndExcludesTrailsWithoutGeoPath()
    {
        // Arrange — the standard seed trails have no GeoPath, so they are filtered out;
        // only this added verified trail with geometry should come back.
        const double startLat = 57.62;
        const double startLon = 12.80;
        var factory = CreateSeededFactory(ctx => ctx.Trails.Add(new Trail
        {
            Identifier = "geo-trail",
            Name = "Geo Trail",
            TrailLength = 5M,
            Accessibility = true,
            IsVerified = true,
            City = "Geo",
            Coordinates = "[]",
            GeoPath = Geometry.DefaultFactory.CreateLineString(
            [
                new Coordinate(startLon, startLat),
                new Coordinate(startLon + 0.01, startLat + 0.01),
            ]),
        }));
        var repo = new TrailRepository(factory, NullLogger<TrailRepository>.Instance);

        // Act
        var result = await repo.GetAllTrailMarkersAsync(
            t => new { t.Identifier, Lat = (double?)t.GeoPath!.StartPoint.Y, Lon = (double?)t.GeoPath!.StartPoint.X },
            CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        var marker = result.Value.Should().ContainSingle().Which;
        marker.Identifier.Should().Be("geo-trail");
        marker.Lat.Should().NotBeNull();
        marker.Lon.Should().NotBeNull();
        marker.Lat!.Value.Should().BeApproximately(startLat, 0.0001);
        marker.Lon!.Value.Should().BeApproximately(startLon, 0.0001);
    }

    [Fact]
    public async Task GetAllTrailsWithBasicInfo_OnlyReturnsVerifiedTrailsWithGeoPath()
    {
        // Arrange
        var factory = CreateSeededFactory(ctx =>
        {
            // Verified + GeoPath -> included
            ctx.Trails.Add(new Trail
            {
                Identifier = "geo-trail",
                Name = "Geo Trail",
                TrailLength = 5M,
                IsVerified = true,
                City = "Geo",
                Coordinates = "[]",
                GeoPath = Geometry.DefaultFactory.CreateLineString(
                    [new Coordinate(12.80, 57.62), new Coordinate(12.81, 57.63)]),
            });
            // Unverified + GeoPath -> excluded by the IsVerified filter
            ctx.Trails.Add(new Trail
            {
                Identifier = "unverified-geo",
                Name = "Unverified Geo",
                TrailLength = 5M,
                IsVerified = false,
                City = "U",
                Coordinates = "[]",
                GeoPath = Geometry.DefaultFactory.CreateLineString(
                    [new Coordinate(1.0, 2.0), new Coordinate(1.1, 2.1)]),
            });
        });
        var repo = new TrailRepository(factory, NullLogger<TrailRepository>.Instance);

        // Act — seed trails (verified, no GeoPath) are also excluded
        var result = await repo.GetAllTrailsWithBasicInfoAsync(
            t => t.Identifier,
            CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEquivalentTo(["geo-trail"]);
    }

    [Fact]
    public async Task AddTrailImages_WhenTrailExists_PersistsImages()
    {
        // Arrange
        var repo = new TrailRepository(CreateSeededFactory(), NullLogger<TrailRepository>.Instance);
        var trailId = (await repo.GetTrailIdByIdentifierAsync(StorsjoledenIdentifier, CancellationToken.None)).Value;
        var images = new List<TrailImage>
        {
            new() { Identifier = "new-img-1", ImageUrl = "trails/new-1.jpg" },
            new() { Identifier = "new-img-2", ImageUrl = "trails/new-2.jpg" },
        };

        // Act
        var result = await repo.AddTrailImagesAsync(trailId, images, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(2);
        result.Value.Should().OnlyContain(i => i.TrailId == trailId);
    }

    [Fact]
    public async Task AddTrailImages_WhenTrailDoesNotExist_ReturnsNotFound()
    {
        // Arrange
        var repo = new TrailRepository(CreateSeededFactory(), NullLogger<TrailRepository>.Instance);
        var images = new List<TrailImage> { new() { Identifier = "x", ImageUrl = "trails/x.jpg" } };

        // Act
        var result = await repo.AddTrailImagesAsync(99999, images, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task DeleteTrailImage_WhenImageExists_RemovesIt()
    {
        // Arrange — "img-storlsjon-1" belongs to Storsjöleden in the seed
        var repo = new TrailRepository(CreateSeededFactory(), NullLogger<TrailRepository>.Instance);

        // Act
        var result = await repo.DeleteTrailImageAsync("img-storlsjon-1", CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();

        // A second delete confirms the image was actually removed
        var second = await repo.DeleteTrailImageAsync("img-storlsjon-1", CancellationToken.None);
        second.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task DeleteTrailImage_WhenImageDoesNotExist_ReturnsNotFound()
    {
        // Arrange
        var repo = new TrailRepository(CreateSeededFactory(), NullLogger<TrailRepository>.Instance);

        // Act
        var result = await repo.DeleteTrailImageAsync("no-such-image", CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task UpdateTrail_WhenTrailExists_UpdatesFields()
    {
        // Arrange
        var repo = new TrailRepository(CreateSeededFactory(), NullLogger<TrailRepository>.Instance);
        var updated = new Trail
        {
            Identifier = StorsjoledenIdentifier,
            Name = "Renamed Trail",
            TrailLength = 42M,
            Classification = 1,
            Accessibility = true,
            City = "NewCity",
        };

        // Act
        var result = await repo.UpdateTrailAsync(updated, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Name.Should().Be("Renamed Trail");
        result.Value.TrailLength.Should().Be(42M);
        result.Value.City.Should().Be("NewCity");
    }

    [Fact]
    public async Task UpdateTrail_WhenTrailDoesNotExist_ReturnsNotFound()
    {
        // Arrange
        var repo = new TrailRepository(CreateSeededFactory(), NullLogger<TrailRepository>.Instance);
        var updated = new Trail { Identifier = "no-such-trail", Name = "X", TrailLength = 1M };

        // Act
        var result = await repo.UpdateTrailAsync(updated, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task UpdateTrail_WhenNoVisitorInformationExists_CreatesIt()
    {
        // Arrange — no seed trail has VisitorInformation set
        var repo = new TrailRepository(CreateSeededFactory(), NullLogger<TrailRepository>.Instance);
        var updated = new Trail
        {
            Identifier = StorsjoledenIdentifier,
            Name = "Storsjöleden",
            TrailLength = 8.5M,
            VisitorInformation = new VisitorInformation { GettingThere = "By bus", Parking = "Free" },
        };

        // Act
        var result = await repo.UpdateTrailAsync(updated, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.VisitorInformation.Should().NotBeNull();
        result.Value.VisitorInformation!.GettingThere.Should().Be("By bus");
        result.Value.VisitorInformation!.Parking.Should().Be("Free");
    }

    [Fact]
    public async Task UpdateTrail_WhenVisitorInformationExists_UpdatesItInPlace()
    {
        // Arrange — attach existing VisitorInformation to the trail before updating
        var factory = CreateSeededFactory(ctx =>
        {
            var trail = ctx.Trails.First(t => t.Identifier == StorsjoledenIdentifier);
            trail.VisitorInformation = new VisitorInformation { GettingThere = "Old", Parking = "Old parking" };
        });
        var repo = new TrailRepository(factory, NullLogger<TrailRepository>.Instance);
        var updated = new Trail
        {
            Identifier = StorsjoledenIdentifier,
            Name = "Storsjöleden",
            TrailLength = 8.5M,
            VisitorInformation = new VisitorInformation
            {
                GettingThere = "Updated",
                Parking = "Updated parking",
                WinterMaintenance = true,
            },
        };

        // Act
        var result = await repo.UpdateTrailAsync(updated, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.VisitorInformation.Should().NotBeNull();
        result.Value.VisitorInformation!.GettingThere.Should().Be("Updated");
        result.Value.VisitorInformation!.WinterMaintenance.Should().BeTrue();
    }
}
