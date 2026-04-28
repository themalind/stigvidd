using Core;
using Core.Interfaces.Repositories;
using Core.Repositories;
using FluentAssertions;
using Infrastructure.Data.Entities;
using Moq;

namespace RepositoryTests;

public class UserResponseRepositoryTests : UnitTests.TestBase
{
    private const string NaturElskarenIdentifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"; // wishlist only
    private const string VandrarVennenIdentifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e"; // favorites only
    private const string ExistingFirebaseUid = "firebase-uid-12345";
    private const string TivedenIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c";
    private const string NassehultIdentifier = "77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c";

    private UserResponseRepository BuildRepo(IFirebaseAuthRepository? firebase = null) =>
        new(CreateSeededFactory(), firebase ?? new Mock<IFirebaseAuthRepository>().Object);

    [Fact]
    public async Task GetUserByFirebaseUid_WhenFound_ReturnsSuccess()
    {
        // Arrange
        var repo = BuildRepo();

        // Act
        var result = await repo.GetUserByFirebaseUidAsync(ExistingFirebaseUid, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task GetUserByFirebaseUid_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = BuildRepo();

        // Act
        var result = await repo.GetUserByFirebaseUidAsync("no-such-uid", CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task GetUserIdByIdentifier_WhenFound_ReturnsId()
    {
        // Arrange
        var repo = BuildRepo();

        // Act
        var result = await repo.GetUserIdByIdentifierAsync(NaturElskarenIdentifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task GetUserIdByIdentifier_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = BuildRepo();

        // Act
        var result = await repo.GetUserIdByIdentifierAsync("no-such-user", CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task GetUserByIdentifier_WhenFound_ReturnsUser()
    {
        // Arrange
        var repo = BuildRepo();

        // Act
        var result = await repo.GetUserByIdentifierAsync(NaturElskarenIdentifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Identifier.Should().Be(NaturElskarenIdentifier);
    }

    [Fact]
    public async Task GetUserByIdentifier_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = BuildRepo();

        // Act
        var result = await repo.GetUserByIdentifierAsync("no-such-user", CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task GetFavoritesByUserIdentifier_WhenHasFavorites_ReturnsList()
    {
        // Arrange
        var repo = BuildRepo();

        // Act
        // VandrarVennen has 2 favorites (Tiveden + Storsjöleden)
        var result = await repo.GetFavoritesByUserIdentifierAsync(VandrarVennenIdentifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetFavoritesByUserIdentifier_WhenNoFavorites_ReturnsEmpty()
    {
        // Arrange
        var repo = BuildRepo();

        // Act
        // NaturElskaren has no favorites set
        var result = await repo.GetFavoritesByUserIdentifierAsync(NaturElskarenIdentifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task GetWishListByUserIdentifier_WhenHasWishlist_ReturnsList()
    {
        // Arrange
        var repo = BuildRepo();

        // Act
        // NaturElskaren has 2 wishlist items (Vildmarksleden + Nässehult)
        var result = await repo.GetWishListByUserIdentifierAsync(NaturElskarenIdentifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetWishListByUserIdentifier_WhenNoWishlist_ReturnsEmpty()
    {
        // Arrange
        var repo = BuildRepo();

        // Act
        // VandrarVennen has no wishlist
        var result = await repo.GetWishListByUserIdentifierAsync(VandrarVennenIdentifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateUser_ShouldPersistAndReturn()
    {
        // Arrange
        var factory = CreateSeededFactory();
        var repo = new UserResponseRepository(factory, new Mock<IFirebaseAuthRepository>().Object);
        var newUser = new User
        {
            Identifier = Guid.NewGuid().ToString(),
            FirebaseUid = "brand-new-firebase-uid",
            NickName = "Glenn",
            Email = "glenn@example.com",
            MyFavorites = [],
            MyWishList = []
        };

        // Act
        var result = await repo.CreateUserAsync(newUser, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.NickName.Should().Be("Glenn");

        var verify = await repo.GetUserByFirebaseUidAsync("brand-new-firebase-uid", CancellationToken.None);
        verify.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task AddTrailToFavorites_WhenValid_ReturnsSuccess()
    {
        // Arrange
        var repo = BuildRepo();

        // Act
        // NaturElskaren has no favorites yet; add Nässehult
        var result = await repo.AddTrailToUserFavoritesListAsync(NaturElskarenIdentifier, NassehultIdentifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Identifier.Should().Be(NassehultIdentifier);
    }

    [Fact]
    public async Task AddTrailToFavorites_WhenUserNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = BuildRepo();

        // Act
        var result = await repo.AddTrailToUserFavoritesListAsync("no-such-user", TivedenIdentifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task AddTrailToFavorites_WhenTrailNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = BuildRepo();

        // Act
        var result = await repo.AddTrailToUserFavoritesListAsync(NaturElskarenIdentifier, "no-such-trail", CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task AddTrailToFavorites_WhenDuplicate_ReturnsConflict()
    {
        // Arrange
        var repo = BuildRepo();

        // Act
        // VandrarVennen already has Tiveden in favorites
        var result = await repo.AddTrailToUserFavoritesListAsync(VandrarVennenIdentifier, TivedenIdentifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.Conflict);
    }

    [Fact]
    public async Task AddTrailToWishList_WhenValid_ReturnsSuccess()
    {
        // Arrange
        var repo = BuildRepo();

        // Act
        // VandrarVennen has no wishlist; add Tiveden
        var result = await repo.AddTrailToUserWishListAsync(VandrarVennenIdentifier, TivedenIdentifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Identifier.Should().Be(TivedenIdentifier);
    }

    [Fact]
    public async Task AddTrailToWishList_WhenUserNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = BuildRepo();

        // Act
        var result = await repo.AddTrailToUserWishListAsync("no-such-user", TivedenIdentifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task AddTrailToWishList_WhenDuplicate_ReturnsConflict()
    {
        // Arrange
        var repo = BuildRepo();

        // Act
        // NaturElskaren already has Nässehult in wishlist
        var result = await repo.AddTrailToUserWishListAsync(NaturElskarenIdentifier, NassehultIdentifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.Conflict);
    }

    [Fact]
    public async Task RemoveFromFavorites_WhenValid_ReturnsSuccess()
    {
        // Arrange
        var repo = BuildRepo();

        // Act
        var result = await repo.RemoveTrailFromUserFavoritesListAsync(VandrarVennenIdentifier, TivedenIdentifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task RemoveFromFavorites_WhenUserNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = BuildRepo();

        // Act
        var result = await repo.RemoveTrailFromUserFavoritesListAsync("no-such-user", TivedenIdentifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task RemoveFromFavorites_WhenTrailNotInList_ReturnsNotFound()
    {
        // Arrange
        var repo = BuildRepo();

        // Act
        // NaturElskaren has no favorites
        var result = await repo.RemoveTrailFromUserFavoritesListAsync(NaturElskarenIdentifier, TivedenIdentifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task RemoveFromWishList_WhenValid_ReturnsSuccess()
    {
        // Arrange
        var repo = BuildRepo();

        // Act
        var result = await repo.RemoveTrailFromUserWishListAsync(NaturElskarenIdentifier, NassehultIdentifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task RemoveFromWishList_WhenUserNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = BuildRepo();

        // Act
        var result = await repo.RemoveTrailFromUserWishListAsync("no-such-user", NassehultIdentifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    // Note: DeleteUserAsync uses BeginTransactionAsync which is not supported by EF InMemory.
    // The happy-path delete is covered by integration tests instead.

    [Fact]
    public async Task DeleteUser_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = BuildRepo();

        // Act
        var result = await repo.DeleteUserAsync("no-such-user", CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }
}
