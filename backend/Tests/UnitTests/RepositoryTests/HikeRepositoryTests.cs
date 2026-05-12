using Core.Repositories;
using FluentAssertions;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace UnitTests.RepositoryTests;

public class HikeRepositoryTests : TestBase
{
    private const string UserIdentifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
    private const int UserIdNoHikes = 4;
    private const int UserIdWithHikes = 1;
    private const string HikeIdentifier = "3f9c1b7e-8a42-4e6d-9c5f-2a7b1d8e4f90";


    [Fact]
    public async Task GetHikeByIdentifier_WhenFound_ReturnsSuccess()
    {
        // Arrange
        var repo = new HikeRepository(CreateSeededFactory(), NullLogger<HikeRepository>.Instance);

        // Act
        var result = await repo.GetHikeByIdentifierAsync(HikeIdentifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Identifier.Should().Be(HikeIdentifier);
        result.Value.Name.Should().Be("TestHike1");
    }

    [Fact]
    public async Task GetHikeByIdentifier_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new HikeRepository(CreateSeededFactory(), NullLogger<HikeRepository>.Instance);

        // Act
        var result = await repo.GetHikeByIdentifierAsync("no-such-hike", CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task GetHikes_WithoutFilter_ReturnsAll()
    {
        // Arrange
        var repo = new HikeRepository(CreateSeededFactory(), NullLogger<HikeRepository>.Instance);

        // Act
        var result = await repo.GetHikesAsync(null, h => h.CreatedBy, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(5);
    }

    [Fact]
    public async Task GetHikes_FilteredByCreator_ReturnsOnlyThatUsersHikes()
    {
        // Arrange
        var repo = new HikeRepository(CreateSeededFactory(), NullLogger<HikeRepository>.Instance);

        // Act
        var result = await repo.GetHikesAsync(UserIdWithHikes, h => h.CreatedBy, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(2);
        result.Value.Should().AllSatisfy(createdBy => createdBy.Should().Be(UserIdentifier));
    }

    [Fact]
    public async Task GetHikes_WhenUserHasNoHikes_ReturnsEmpty()
    {
        // Arrange
        var repo = new HikeRepository(CreateSeededFactory(), NullLogger<HikeRepository>.Instance);

        // Act
        // User 4 (Eremiten) owns no hikes in seed data
        var result = await repo.GetHikesAsync(UserIdNoHikes, h => h.CreatedBy, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateHike_ShouldPersistAndReturn()
    {
        // Arrange
        var factory = CreateSeededFactory();
        var repo = new HikeRepository(factory, NullLogger<HikeRepository>.Instance);
        var hike = new Hike
        {
            Identifier = Guid.NewGuid().ToString(),
            Name = "NewHike",
            HikeLength = 7,
            Duration = 3600000,
            Coordinates = "[]",
            CreatedBy = UserIdentifier
        };

        // Act
        var result = await repo.CreateHikeAsync(hike, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Name.Should().Be("NewHike");

        var verify = await repo.GetHikeByIdentifierAsync(hike.Identifier, CancellationToken.None);
        verify.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task GetHikeIdByIdentifier_WhenFound_ReturnsId()
    {
        // Arrange
        var repo = new HikeRepository(CreateSeededFactory(), NullLogger<HikeRepository>.Instance);

        // Act
        var result = await repo.GetHikeIdByIdentifierAsync(HikeIdentifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task GetHikeIdByIdentifier_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new HikeRepository(CreateSeededFactory(), NullLogger<HikeRepository>.Instance);

        // Act
        var result = await repo.GetHikeIdByIdentifierAsync("no-such-hike", CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task SoftDeleteHike_WhenHasShares_SetsUserIdNull()
    {
        // Arrange — build an in-memory DB that includes a HikeShare for Hike 1
        var options = new DbContextOptionsBuilder<StigViddDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        using (var seed = new StigViddDbContext(options))
        {
            seed.Database.EnsureCreated();
            Utilities.InitializeDbForTests(seed);
            seed.HikeShares.Add(new HikeShare { HikeId = 1, SharedWithId = 2, SharedById = 1 });
            seed.SaveChanges();
        }

        var factory = new Mock<IDbContextFactory<StigViddDbContext>>();
        factory.Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => new StigViddDbContext(options));

        var repo = new HikeRepository(factory.Object, NullLogger<HikeRepository>.Instance);
        var found = await repo.GetHikeByIdentifierAsync(HikeIdentifier, CancellationToken.None);
        found.IsSuccess.Should().BeTrue();

        // Act
        var deleteResult = await repo.SoftDeleteHikeAsync(found.Value!, CancellationToken.None);

        // Assert — hike still exists (not soft-deleted) but owner is cleared
        deleteResult.IsSuccess.Should().BeTrue();
        var verify = await repo.GetHikeByIdentifierAsync(HikeIdentifier, CancellationToken.None);
        verify.IsSuccess.Should().BeTrue();
        verify.Value!.UserId.Should().BeNull();
        verify.Value.IsDeleted.Should().BeFalse();
    }

    [Fact]
    public async Task DeleteHike_ShouldRemoveFromDatabase()
    {
        // Arrange
        var factory = CreateSeededFactory();
        var repo = new HikeRepository(factory, NullLogger<HikeRepository>.Instance);
        var found = await repo.GetHikeByIdentifierAsync(HikeIdentifier, CancellationToken.None);
        found.IsSuccess.Should().BeTrue();

        // Act
        found.Value.Should().NotBeNull();
        var deleteResult = await repo.SoftDeleteHikeAsync(found.Value, CancellationToken.None);

        // Assert
        deleteResult.IsSuccess.Should().BeTrue();

        var verify = await repo.GetHikeByIdentifierAsync(HikeIdentifier, CancellationToken.None);
        verify.IsSuccess.Should().BeFalse();
    }
}
