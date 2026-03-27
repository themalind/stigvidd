using Core;
using Core.Factories;
using Core.Interfaces;
using Core.Services;
using FluentAssertions;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using WebDataContracts.ResponseModels.User;

namespace ServiceTests;

public class UserServiceTests : TestBase
{
    #region Seed identifiers

    // Users
    private const string NaturElskarenIdentifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"; // User 1: wishlist only
    private const int NaturElskarenUserId = 1;
    private const string VandrarVennenIdentifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e"; // User 2: favorites only
    private const string SkogsGrenIdentifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d67";     // User 3: favorites + null wishlist
    private const string EremitenIdentifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d22";      // User 4: null favorites
    private const string KattletenIdentifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5a33";     // User 5: empty favorites
    private const string Molgan75Identifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5a44";      // User 6: empty wishlist
    private const string NonExistentUserIdentifier = "77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c";

    // Trails
    private const string TivedenIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c";
    private const string StorsjoledenIdentifier = "22b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
    private const string VildmarksledenArasIdentifier = "44d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f";
    private const string NassehultIdentifier = "77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c";
    private const string HultaforsIdentifier = "66f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b"; // valid trail, not in any tested user's lists

    // Firebase UIDs
    private const string ExistingFirebaseUid = "firebase-uid-12345";

    #endregion

    [Fact]
    public async Task GetFavoritesByUserIdentifier_ReturnsOk()
    {
        // Arrange
        var userService = CreateUserService();

        // Act
        var result = await userService.GetFavoritesByUserIdentifierAsync(NaturElskarenIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task GetUserFavorites_ReturnsList_WithRightProperties()
    {
        // Arrange
        var userService = CreateUserService();

        // Act
        var result = await userService.GetFavoritesByUserIdentifierAsync(VandrarVennenIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull()
                .And.HaveCount(2);
        result.Value.Select(t => t!.Identifier)
                .Should()
                .ContainInOrder([StorsjoledenIdentifier, TivedenIdentifier]);
        result.Value.Select(t => t!.Name)
                .Should()
                .ContainInOrder(["Storsjöleden", "Tiveden"]);
    }

    [Fact]
    public async Task GetFavoritesList_WithInvalidUserIdentifier_ReturnsEmptyList()
    {
        // Arrange
        var userService = CreateUserService();

        // Act
        var result = await userService.GetFavoritesByUserIdentifierAsync(NonExistentUserIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task AddToFavoritesList_WithInvalidUserIdentifier_ReturnsCorrectErrorMessage()
    {
        // Arrange
        var userService = CreateUserService();

        // Act
        var result = await userService.AddTrailToUserFavoritesListAsync(
          NonExistentUserIdentifier, NonExistentUserIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be($"User with identifier {NonExistentUserIdentifier} not found.");
    }

    [Fact]
    public async Task AddTrailToUserFavorites_ReturnsUserFavoritesTrailResponse()
    {
        // Arrange
        var userService = CreateUserService();

        // Act
        var result = await userService.AddTrailToUserFavoritesListAsync(
            NaturElskarenIdentifier, NassehultIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Should().BeOfType<Result<UserFavoritesTrailResponse>>();
    }

    [Fact]
    public async Task AddToUserFavorites_WithInvalidTrailIdentifier_ReturnsCorrectErrorMessage()
    {
        // Arrange
        var userService = CreateUserService();

        // Act
        var result = await userService.AddTrailToUserFavoritesListAsync(
            NaturElskarenIdentifier, NaturElskarenIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Value.Should().BeNull();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be($"Trail with identifier: {NaturElskarenIdentifier} not found.");
    }

    [Fact]
    public async Task AddTrailToUserFavorites_WithDuplicateTrail_ReturnsFailureResult()
    {
        // Arrange
        var userService = CreateUserService();

        // Act
        var result = await userService.AddTrailToUserFavoritesListAsync(
            VandrarVennenIdentifier, TivedenIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Value.Should().BeNull();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(409);
        result.Message.ResultMessage.Should().Be($"Trail {TivedenIdentifier} already in user favorites");
    }

    [Fact]
    public async Task RemoveTrailFromUserFavorites_ReturnsSuccessResult()
    {
        // Arrange
        var userService = CreateUserService();

        // Act
        var result = await userService.RemoveTrailFromUserFavoritesListAsync(
            VandrarVennenIdentifier, TivedenIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task RemoveTrailFromUserFavorites_WithInvalidUserIdentifier_ReturnsCorrectErrorMessage()
    {
        // Arrange
        var userService = CreateUserService();

        // Act
        var result = await userService.RemoveTrailFromUserFavoritesListAsync(
            NonExistentUserIdentifier, TivedenIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be($"No user found with identifier {NonExistentUserIdentifier}");
    }

    [Fact]
    public async Task RemoveTrailFromUserFavorites_WithInvalidTrailIdentifier_ReturnsCorrectErrorMessage()
    {
        // Arrange
        var userService = CreateUserService();

        // Act
        var result = await userService.RemoveTrailFromUserFavoritesListAsync(
            VandrarVennenIdentifier, HultaforsIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(409);
        result.Message.ResultMessage.Should().Be($"Trail {HultaforsIdentifier} not in user favorites");
    }

    [Fact]
    public async Task RemoveFromUserFavorites_WhenFavoritesIsNull_ShouldReturnCorrectErrorMessage()
    {
        // Arrange
        var userService = CreateUserService();

        // Act
        var result = await userService.RemoveTrailFromUserFavoritesListAsync(
            EremitenIdentifier, NonExistentUserIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("User has no favorites");
    }

    [Fact]
    public async Task RemoveFromUserFavorites_WhenFavoritesIsEmpty_ShouldReturnCorrectErrorMessage()
    {
        // Arrange
        var userService = CreateUserService();

        // Act
        var result = await userService.RemoveTrailFromUserFavoritesListAsync(
            KattletenIdentifier, NonExistentUserIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("User has no favorites");
    }

    [Fact]
    public async Task GetWishListByUserIdentifier_ReturnsList_WithRightProperties()
    {
        // Arrange
        var userService = CreateUserService();

        // Act
        var result = await userService.GetWishListByUserIdentifierAsync(NaturElskarenIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull()
                .And.HaveCount(2);

        result.Value.Select(t => t!.Identifier)
                .Should()
                .ContainInOrder([NassehultIdentifier, VildmarksledenArasIdentifier]);
        result.Value.Select(t => t!.Name)
                .Should()
                .ContainInOrder(["Nässehult", "Vildmarksleden Årås"]);
    }

    [Fact]
    public async Task GetWishListByUserIdentifier_WhenNoWishlistExists_ReturnsEmptyList()
    {
        // Arrange
        var userService = CreateUserService();

        // Act
        var result = await userService.GetWishListByUserIdentifierAsync(VandrarVennenIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task GetWishList_WithInvalidUserIdentifier_ReturnsEmptyList()
    {
        // Arrange
        var userService = CreateUserService();

        // Act
        var result = await userService.GetWishListByUserIdentifierAsync(NonExistentUserIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task AddToWishList_WithInvalidUserIdentifier_ReturnsCorrectErrorMessage()
    {
        // Arrange
        var userService = CreateUserService();

        // Act
        var result = await userService.AddTrailToUserWishListAsync(
          NonExistentUserIdentifier, VildmarksledenArasIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be($"User with identifier {NonExistentUserIdentifier} not found.");
    }

    [Fact]
    public async Task AddTrailToUserWishList_ReturnsUserWishlistTrailResponse()
    {
        // Arrange
        var userService = CreateUserService();

        // Act
        var result = await userService.AddTrailToUserWishListAsync(
            VandrarVennenIdentifier, VildmarksledenArasIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Should().BeOfType<Result<UserWishlistTrailResponse>>();
    }

    [Fact]
    public async Task AddToUserWishList_WithInvalidTrailIdentifier_ReturnsCorrectErrorMessage()
    {
        // Arrange
        var userService = CreateUserService();

        // Act
        var result = await userService.AddTrailToUserWishListAsync(
            VandrarVennenIdentifier, NaturElskarenIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be($"Trail with identifier: {NaturElskarenIdentifier} not found");
    }

    [Fact]
    public async Task AddTrailToUserWishList_WithDuplicateTrail_ReturnsFailureResult()
    {
        // Arrange
        var userService = CreateUserService();

        // Act
        var result = await userService.AddTrailToUserWishListAsync(
            NaturElskarenIdentifier, NassehultIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Value.Should().BeNull();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(409);
        result.Message.ResultMessage.Should().Be($"Trail {NassehultIdentifier} already in user wishlist");
    }

    [Fact]
    public async Task RemoveTrailFromUserWishList_ReturnsSuccessResult()
    {
        // Arrange
        var userService = CreateUserService();

        // Act
        var result = await userService.RemoveTrailFromUserWishListAsync(
            NaturElskarenIdentifier, VildmarksledenArasIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task RemoveTrailFromUserWishList_WithInvalidUserIdentifier_ReturnsCorrectErrorMessage()
    {
        // Arrange
        var userService = CreateUserService();

        // Act
        var result = await userService.RemoveTrailFromUserWishListAsync(
            NonExistentUserIdentifier, VildmarksledenArasIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be($"No user found with identifier {NonExistentUserIdentifier}");
    }

    [Fact]
    public async Task RemoveTrailFromUserWishList_WithInvalidTrailIdentifier_ReturnsCorrectErrorMessage()
    {
        // Arrange
        var userService = CreateUserService();

        // Act
        var result = await userService.RemoveTrailFromUserWishListAsync(
            NaturElskarenIdentifier, NaturElskarenIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(409);
        result.Message.ResultMessage.Should().Be($"Trail {NaturElskarenIdentifier} not in user wishlist");
    }

    [Fact]
    public async Task RemoveFromUserWishlist_WhenWishlistIsNull_ShouldReturnCorrectErrorMessage()
    {
        // Arrange
        var userService = CreateUserService();

        // Act
        var result = await userService.RemoveTrailFromUserWishListAsync(
            SkogsGrenIdentifier, NonExistentUserIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("User has no wishlist");
    }

    [Fact]
    public async Task RemoveFromUserWishlist_WhenWishlistIsEmpty_ShouldReturnCorrectErrorMessage()
    {
        // Arrange
        var userService = CreateUserService();

        // Act
        var result = await userService.RemoveTrailFromUserWishListAsync(
            Molgan75Identifier, NonExistentUserIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("User has no wishlist");
    }

    [Fact]
    public async Task CreateUserAsync_WhenFirebaseUidDoesNotExist_ShouldCreateUser()
    {
        // Arrange
        var service = CreateUserService();

        // Act
        var result = await service.CreateUserAsync("glenn@raggigast.se", "Glenn", "brand-new-firebase-uid", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Email.Should().Be("glenn@raggigast.se");
        result.Value.NickName.Should().Be("Glenn");
    }

    [Fact]
    public async Task CreateUserAsync_WhenFirebaseUidAlreadyExists_ShouldReturnConflict()
    {
        // Arrange
        var service = CreateUserService();

        // Act — all seed users share "firebase-uid-12345"
        var result = await service.CreateUserAsync("artemis@fluffigast.se", "Artemis", ExistingFirebaseUid, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task GetUserByFirebaseUidAsync_WhenFound_ShouldReturnUser()
    {
        // Arrange
        var service = CreateUserService();

        // Act
        var result = await service.GetUserByFirebaseUidAsync(ExistingFirebaseUid, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task GetUserByFirebaseUidAsync_WhenNotFound_ShouldFail()
    {
        // Arrange
        var service = CreateUserService();

        // Act
        var result = await service.GetUserByFirebaseUidAsync("does-not-exist", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task DeleteUserAsync_WhenUserExistsAndFirebaseSucceeds_ShouldDeleteUser()
    {
        // Arrange
        var mockFirebase = new Mock<IFirebaseAuthService>();
        mockFirebase
            .Setup(f => f.DeleteUserAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var options = CreateSeededOptions();
        var service = CreateUserServiceWithOptions(options, mockFirebase.Object);

        // Act
        var result = await service.DeleteUserAsync(NaturElskarenIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();

        using var verifyContext = new StigViddDbContext(options);
        verifyContext.Users.Any(u => u.Identifier == NaturElskarenIdentifier).Should().BeFalse();

        // Solved votes belonging to the deleted user should also be removed via cascade
        verifyContext.TrailObstacleSolvedVotes.Any(sv => sv.UserId == NaturElskarenUserId).Should().BeFalse();
    }

    [Fact]
    public async Task DeleteUserAsync_WhenUserNotFound_ShouldFail()
    {
        // Arrange
        var service = CreateUserService();

        // Act
        var result = await service.DeleteUserAsync("does-not-exist", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task DeleteUserAsync_WhenFirebaseDeletionFails_ShouldRollbackDbDeletion()
    {
        // Arrange
        var mockFirebase = new Mock<IFirebaseAuthService>();
        mockFirebase
            .Setup(f => f.DeleteUserAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("Firebase unavailable"));

        var options = CreateSeededOptions();
        var service = CreateUserServiceWithOptions(options, mockFirebase.Object);

        // Act
        var result = await service.DeleteUserAsync(NaturElskarenIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);

        // User must still exist — the DB deletion must have been rolled back
        using var verifyContext = new StigViddDbContext(options);
        verifyContext.Users.Any(u => u.Identifier == NaturElskarenIdentifier).Should().BeTrue();
    }

    private UserService CreateUserServiceWithOptions(
            DbContextOptions<StigViddDbContext> options,
            IFirebaseAuthService firebaseAuthService)
    {
        var mockContextFactory = new Mock<IDbContextFactory<StigViddDbContext>>();
        mockContextFactory
            .Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => new StigViddDbContext(options));

        return new UserService(
            mockContextFactory.Object,
            new Mock<ILogger<UserService>>().Object,
            firebaseAuthService,
            new UserFavoritesResponseFactory(),
            new UserWishlistResponseFactory(),
            new UserResponseFactory()
        );
    }

    private UserService CreateUserService()
    {
        var mockContextFactory = new Mock<IDbContextFactory<StigViddDbContext>>();
        mockContextFactory
            .Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => CreateContextAndSqliteDb());

        return new UserService(
            mockContextFactory.Object,
            new Mock<ILogger<UserService>>().Object,
            new Mock<IFirebaseAuthService>().Object,
            new UserFavoritesResponseFactory(),
            new UserWishlistResponseFactory(),
            new UserResponseFactory()
        );
    }
}
