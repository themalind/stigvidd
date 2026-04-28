using Core;
using Core.Repositories;
using FluentAssertions;
using Infrastructure.Data.Entities;

namespace UnitTests.RepositoryTests;

public class HikeResponseRepositoryTests : TestBase
{
    private const string UserIdentifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
    private const string HikeIdentifier = "3f9c1b7e-8a42-4e6d-9c5f-2a7b1d8e4f90";

    [Fact]
    public async Task GetHikeByIdentifier_WhenFound_ReturnsSuccess()
    {
        // Arrange
        var repo = new HikeResponseRepository(CreateSeededFactory());

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
        var repo = new HikeResponseRepository(CreateSeededFactory());

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
        var repo = new HikeResponseRepository(CreateSeededFactory());

        // Act
        var result = await repo.GetHikesAsync(null, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(5);
    }

    [Fact]
    public async Task GetHikes_FilteredByCreator_ReturnsOnlyThatUsersHikes()
    {
        // Arrange
        var repo = new HikeResponseRepository(CreateSeededFactory());

        // Act
        var result = await repo.GetHikesAsync(UserIdentifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(2);
        result.Value.Should().AllSatisfy(h => h.CreatedBy.Should().Be(UserIdentifier));
    }

    [Fact]
    public async Task GetHikes_WhenUserHasNoHikes_ReturnsEmpty()
    {
        // Arrange
        var repo = new HikeResponseRepository(CreateSeededFactory());

        // Act
        // User 4 (Eremiten) owns no hikes in seed data
        var result = await repo.GetHikesAsync("b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d22", CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateHike_ShouldPersistAndReturn()
    {
        // Arrange
        var factory = CreateSeededFactory();
        var repo = new HikeResponseRepository(factory);
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
    public async Task DeleteHike_ShouldRemoveFromDatabase()
    {
        // Arrange
        var factory = CreateSeededFactory();
        var repo = new HikeResponseRepository(factory);
        var found = await repo.GetHikeByIdentifierAsync(HikeIdentifier, CancellationToken.None);
        found.IsSuccess.Should().BeTrue();

        // Act
        var deleteResult = await repo.DeleteHikeAsync(found.Value!, CancellationToken.None);

        // Assert
        deleteResult.IsSuccess.Should().BeTrue();

        var verify = await repo.GetHikeByIdentifierAsync(HikeIdentifier, CancellationToken.None);
        verify.IsSuccess.Should().BeFalse();
    }
}
