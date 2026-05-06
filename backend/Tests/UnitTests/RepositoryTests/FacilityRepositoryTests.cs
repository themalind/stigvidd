using Core.Repositories;
using FluentAssertions;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace UnitTests.RepositoryTests;

public class FacilityRepositoryTests
{
    private const string Facility1Identifier = "fac1a1b2-c3d4-4e5f-6a7b-8c9d0e1f2a3b";
    private const string Facility2Identifier = "fac2b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c";

    private static IDbContextFactory<StigViddDbContext> CreateFactory(IEnumerable<Facility>? facilities = null)
    {
        var options = new DbContextOptionsBuilder<StigViddDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        using var ctx = new StigViddDbContext(options);
        if (facilities != null)
            ctx.Facilities.AddRange(facilities);
        ctx.SaveChanges();

        var mock = new Mock<IDbContextFactory<StigViddDbContext>>();
        mock.Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => new StigViddDbContext(options));
        return mock.Object;
    }

    private static Facility MakeFacility(int id = 1, string? identifier = null, string name = "Grillplats Tiveden") => new()
    {
        Id = id,
        Identifier = identifier ?? Facility1Identifier,
        Name = name,
        FacilityType = FacilityType.FirePit,
        IsAccessible = true,
        Latitude = 58.9M,
        Longitude = 14.5M,
        CreatedAt = DateTime.UtcNow,
        LastUpdatedAt = DateTime.UtcNow
    };

    [Fact]
    public async Task CreateFacilityAsync_WhenValid_ReturnsFacility()
    {
        // Arrange
        var repo = new FacilityRepository(CreateFactory(), NullLogger<FacilityRepository>.Instance);

        // Act
        var result = await repo.CreateFacilityAsync(MakeFacility(), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Name.Should().Be("Grillplats Tiveden");
    }

    [Fact]
    public async Task CreateFacilityAsync_PersistsToDatabase()
    {
        // Arrange
        var factory = CreateFactory();
        var repo = new FacilityRepository(factory, NullLogger<FacilityRepository>.Instance);

        // Act
        await repo.CreateFacilityAsync(MakeFacility(), CancellationToken.None);

        // Assert
        var verify = await repo.GetByIdentifierAsync(Facility1Identifier, CancellationToken.None);
        verify.IsSuccess.Should().BeTrue();
        verify.Value.Should().NotBeNull();
        verify.Value.Name.Should().Be("Grillplats Tiveden");
    }

    [Fact]
    public async Task GetAllAsync_WhenFacilitiesExist_ReturnsAll()
    {
        // Arrange
        var factory = CreateFactory([MakeFacility(1, Facility1Identifier), MakeFacility(2, Facility2Identifier, "Vindskydd Gesebol")]);
        var repo = new FacilityRepository(factory, NullLogger<FacilityRepository>.Instance);

        // Act
        var result = await repo.GetAllAsync(CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetAllAsync_WhenNoneExist_ReturnsEmptyCollection()
    {
        // Arrange
        var repo = new FacilityRepository(CreateFactory(), NullLogger<FacilityRepository>.Instance);

        // Act
        var result = await repo.GetAllAsync(CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task GetByIdentifierAsync_WhenFound_ReturnsSuccess()
    {
        // Arrange
        var repo = new FacilityRepository(CreateFactory([MakeFacility()]), NullLogger<FacilityRepository>.Instance);

        // Act
        var result = await repo.GetByIdentifierAsync(Facility1Identifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Identifier.Should().Be(Facility1Identifier);
    }

    [Fact]
    public async Task GetByIdentifierAsync_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new FacilityRepository(CreateFactory(), NullLogger<FacilityRepository>.Instance);

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
        var factory = CreateFactory([MakeFacility()]);
        var repo = new FacilityRepository(factory, NullLogger<FacilityRepository>.Instance);
        var found = await repo.GetByIdentifierAsync(Facility1Identifier, CancellationToken.None);
        found.Value.Should().NotBeNull();
        found.IsSuccess.Should().BeTrue();

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
        var factory = CreateFactory([MakeFacility()]);
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
        var factory = CreateFactory([MakeFacility()]);
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
}
