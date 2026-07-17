using System.Linq.Expressions;
using Core.Repositories;
using Core.Services;
using FluentAssertions;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Logging.Abstractions;

namespace UnitTests.RepositoryTests;

public class CityAreaRepositoryTests : TestBase
{
    private const string LinkedAreaIdentifier = "area-dalsjofors";

    // Mirrors the selector CityAreaService uses, so these tests exercise the same projection the
    // service relies on (and confirm EF can translate the nested facility/trail projections).
    private static readonly Expression<Func<CityArea, CityAreaProjection>> Selector = area => new CityAreaProjection(
        area.Identifier,
        area.Name,
        area.Location,
        area.Description,
        area.ImageUrl,
        area.Url,
        area.Facilities!.Select(f => new CityAreaFacilityProjection(
            f.Identifier, f.Name, (int)f.FacilityType, f.IsAccessible, f.Location, f.Description, f.Url)).ToList(),
        area.Trails!.Select(t => new CityAreaTrailProjection(
            t.Identifier, t.Name, t.TrailLength, t.Classification, t.Description,
            t.Reviews!.Any() ? t.Reviews!.Average(r => r.Rating) : 0m,
            t.TrailImages!.Select(i => new CityAreaTrailImageProjection(i.Identifier, i.ImageUrl)).FirstOrDefault())).ToList());


    // Seeds a city area linked (m2m) to an existing trail and firepit facility on top of the
    // standard seed, so the repository's projection of Facilities/Trails can be verified.
    private static void SeedLinkedArea(Infrastructure.Data.StigViddDbContext db)
    {
        var trail = db.Trails.First(t => t.Id == 1);       // Tiveden
        var facility = db.Facilities.First(f => f.Id == 1); // Grillplats Tiveden

        db.CityAreas.Add(new CityArea
        {
            Id = 1,
            Identifier = LinkedAreaIdentifier,
            Name = "Dalsjöfors",
            Location = "Öster om Borås",
            Trails = [trail],
            Facilities = [facility],
            CreatedAt = Utilities.SeedDates.Created,
            LastUpdatedAt = Utilities.SeedDates.Updated
        });
    }

    [Fact]
    public async Task GetAllAsync_WhenCityAreasExist_ReturnsAll()
    {
        // Arrange
        var repo = new CityAreaRepository(CreateSeededFactory(SeedLinkedArea), NullLogger<CityAreaRepository>.Instance);

        // Act
        var result = await repo.GetAllAsync(Selector, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetByIdentifierAsync_WhenFound_ProjectsFacilitiesAndTrails()
    {
        // Arrange
        var repo = new CityAreaRepository(CreateSeededFactory(SeedLinkedArea), NullLogger<CityAreaRepository>.Instance);

        // Act
        var result = await repo.GetByIdentifierAsync(LinkedAreaIdentifier, Selector, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Identifier.Should().Be(LinkedAreaIdentifier);
        result.Value.Facilities.Should().ContainSingle(f => f.Name == "Grillplats Tiveden");
        result.Value.Trails.Should().ContainSingle(t => t.Name == "Tiveden");
    }

    [Fact]
    public async Task GetByIdentifierAsync_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new CityAreaRepository(CreateSeededFactory(SeedLinkedArea), NullLogger<CityAreaRepository>.Instance);

        // Act
        var result = await repo.GetByIdentifierAsync("no-such-area", Selector, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }
}
