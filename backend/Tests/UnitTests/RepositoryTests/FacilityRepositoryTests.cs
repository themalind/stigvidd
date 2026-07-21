using Core.Repositories;
using FluentAssertions;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Logging.Abstractions;

namespace UnitTests.RepositoryTests;

public class FacilityRepositoryTests : TestBase
{
    private const string Facility1Identifier = Utilities.Identifiers.Facility1;

    [Fact]
    public async Task CreateFacilityAsync_WhenValid_ReturnsFacility()
    {
        // Arrange
        var repo = new FacilityRepository(CreateSeededFactory(), NullLogger<FacilityRepository>.Instance);
        var facility = new Facility
        {
            Identifier = Guid.NewGuid().ToString(),
            Name = "Ny Grillplats",
            FacilityType = FacilityType.FirePit,
            IsAccessible = true,
            Latitude = 57.5M,
            Longitude = 13.2M,
            CreatedAt = DateTime.UtcNow,
            LastUpdatedAt = DateTime.UtcNow
        };

        // Act
        var result = await repo.CreateFacilityAsync(facility, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Name.Should().Be("Ny Grillplats");
    }

    [Fact]
    public async Task CreateFacilityAsync_PersistsToDatabase()
    {
        // Arrange
        var factory = CreateSeededFactory();
        var repo = new FacilityRepository(factory, NullLogger<FacilityRepository>.Instance);
        var identifier = Guid.NewGuid().ToString();
        var facility = new Facility
        {
            Identifier = identifier,
            Name = "Ny Grillplats",
            FacilityType = FacilityType.FirePit,
            IsAccessible = true,
            Latitude = 57.5M,
            Longitude = 13.2M,
            CreatedAt = DateTime.UtcNow,
            LastUpdatedAt = DateTime.UtcNow
        };

        // Act
        await repo.CreateFacilityAsync(facility, CancellationToken.None);

        // Assert
        var verify = await repo.GetByIdentifierAsync(identifier, CancellationToken.None);
        verify.IsSuccess.Should().BeTrue();
        verify.Value.Should().NotBeNull();
        verify.Value.Name.Should().Be("Ny Grillplats");
    }

    [Fact]
    public async Task GetAllAsync_WhenFacilitiesExist_ReturnsAll()
    {
        // Arrange
        var repo = new FacilityRepository(CreateSeededFactory(), NullLogger<FacilityRepository>.Instance);

        // Act
        var result = await repo.GetAllAsync(CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetByIdentifierAsync_WhenFound_ReturnsSuccess()
    {
        // Arrange
        var repo = new FacilityRepository(CreateSeededFactory(), NullLogger<FacilityRepository>.Instance);

        // Act
        var result = await repo.GetByIdentifierAsync(Facility1Identifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Identifier.Should().Be(Facility1Identifier);
        result.Value.Name.Should().Be("Grillplats Tiveden");
    }

    [Fact]
    public async Task GetByIdentifierAsync_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new FacilityRepository(CreateSeededFactory(), NullLogger<FacilityRepository>.Instance);

        // Act
        var result = await repo.GetByIdentifierAsync("no-such-facility", CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task UpdateAsync_PersistsChanges()
    {
        // Arrange
        var factory = CreateSeededFactory();
        var repo = new FacilityRepository(factory, NullLogger<FacilityRepository>.Instance);
        var found = await repo.GetByIdentifierAsync(Facility1Identifier, CancellationToken.None);
        found.IsSuccess.Should().BeTrue();
        found.Value.Should().NotBeNull();

        var facility = found.Value;
        facility.Name = "Updated Name";

        // Act
        await repo.UpdateAsync(facility, CancellationToken.None);

        // Assert
        var verify = await repo.GetByIdentifierAsync(Facility1Identifier, CancellationToken.None);
        verify.Value.Should().NotBeNull();
        verify.Value.Name.Should().Be("Updated Name");
    }

    [Fact]
    public async Task UpdateAsync_SetsLastUpdatedAtToUtcNow()
    {
        // Arrange
        var factory = CreateSeededFactory();
        var repo = new FacilityRepository(factory, NullLogger<FacilityRepository>.Instance);
        var found = await repo.GetByIdentifierAsync(Facility1Identifier, CancellationToken.None);
        found.Value.Should().NotBeNull();

        var facility = found.Value;
        var before = DateTime.UtcNow;

        // Act
        await repo.UpdateAsync(facility, CancellationToken.None);
        var after = DateTime.UtcNow;

        // Assert
        var persisted = await repo.GetByIdentifierAsync(Facility1Identifier, CancellationToken.None);
        persisted.Value.Should().NotBeNull();
        persisted.Value.LastUpdatedAt.Should().BeOnOrAfter(before).And.BeOnOrBefore(after);
    }

    [Fact]
    public async Task DeleteAsync_RemovesFacilityFromDatabase()
    {
        // Arrange
        var factory = CreateSeededFactory();
        var repo = new FacilityRepository(factory, NullLogger<FacilityRepository>.Instance);
        var found = await repo.GetByIdentifierAsync(Facility1Identifier, CancellationToken.None);
        found.Value.Should().NotBeNull();

        // Act
        await repo.DeleteAsync(found.Value, CancellationToken.None);

        // Assert
        var verify = await repo.GetByIdentifierAsync(Facility1Identifier, CancellationToken.None);
        verify.IsSuccess.Should().BeFalse();
        verify.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    private static FacilityImage MakeImage(string identifier, string url = "facilities/img.jpg") => new()
    {
        Identifier = identifier,
        ImageUrl = url,
        Width = 800,
        Height = 600,
        SizeBytes = 12345,
        CreatedAt = DateTime.UtcNow,
        LastUpdatedAt = DateTime.UtcNow
    };

    [Fact]
    public async Task AddFacilityImagesAsync_WhenFacilityExists_PersistsImagesLinkedToFacility()
    {
        // Arrange — seeded facility with Id 1 is "Grillplats Tiveden".
        var factory = CreateSeededFactory();
        var repo = new FacilityRepository(factory, NullLogger<FacilityRepository>.Instance);
        var images = new List<FacilityImage> { MakeImage("fac-img-1"), MakeImage("fac-img-2") };

        // Act
        var result = await repo.AddFacilityImagesAsync(1, images, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(2);
        result.Value.Should().OnlyContain(i => i.FacilityId == 1);
    }

    [Fact]
    public async Task AddFacilityImagesAsync_WhenFacilityMissing_ReturnsNotFound()
    {
        // Arrange
        var factory = CreateSeededFactory();
        var repo = new FacilityRepository(factory, NullLogger<FacilityRepository>.Instance);
        var images = new List<FacilityImage> { MakeImage("fac-img-1") };

        // Act
        var result = await repo.AddFacilityImagesAsync(9999, images, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task DeleteFacilityImageAsync_WhenImageExists_RemovesIt()
    {
        // Arrange
        var factory = CreateSeededFactory();
        var repo = new FacilityRepository(factory, NullLogger<FacilityRepository>.Instance);
        await repo.AddFacilityImagesAsync(1, new List<FacilityImage> { MakeImage("fac-img-del") }, CancellationToken.None);

        // Act
        var result = await repo.DeleteFacilityImageAsync("fac-img-del", CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();

        // Deleting again should now report NotFound, confirming it was removed.
        var second = await repo.DeleteFacilityImageAsync("fac-img-del", CancellationToken.None);
        second.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task DeleteFacilityImageAsync_WhenImageMissing_ReturnsNotFound()
    {
        // Arrange
        var factory = CreateSeededFactory();
        var repo = new FacilityRepository(factory, NullLogger<FacilityRepository>.Instance);

        // Act
        var result = await repo.DeleteFacilityImageAsync("no-such-image", CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }
}
