using Core;
using Core.Factories;
using Core.Services;
using FluentAssertions;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using WebDataContracts.ResponseModels.User;

namespace UnitTests;

public class UserServiceUnitTests
{
    [Fact]
    public async Task GetFavoritesByUserIdentifier_ReturnsOk()
    {
        // Arrange 
        var userService = CreateUserService();

        // Act 
        var result = await userService.GetFavoritesByUserIdentifierAsync("a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task GetFavoritesByUserIdentifier_WhenNoFavoritesExists_ReturnsEmptyList()
    {
        // Arrange 
        var userService = CreateUserService();

        // Act 
        var result = await userService.GetFavoritesByUserIdentifierAsync("b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetUserFavorites_ReturnsList_WithRightProperties()
    {
        // Arrange 
        var userService = CreateUserService();

        // Act 
        var result = await userService.GetFavoritesByUserIdentifierAsync("b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull()
                .And.HaveCount(2);
        result.Value.Select(t => t!.Identifier)
                .Should()
                .ContainInOrder(["11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c", "22b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"]);
        result.Value.Select(t => t!.Name)
                .Should()
                .ContainInOrder(["Tiveden", "Storsjöleden"]);

    }

    [Fact]
    public async Task GetFavoritesList_WithInvalidUserIdentifier_ReturnsNull()
    {
        // Arrange 
        var userService = CreateUserService();

        // Act 
        var result = await userService.GetFavoritesByUserIdentifierAsync("77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Value.Should().BeNull();
    }

    [Fact]
    public async Task AddToFavoritesList_WithInvalidUserIdentifier_ReturnsCorrectErrorMessage()
    {
        // Arrange 
        var userService = CreateUserService();

        // Act 
        var result = await userService.AddTrailToUserFavoritesListAsync(
          "77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c", "77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("User with identifier 77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c not found.");
    }

    [Fact]
    public async Task AddTrailToUserFavorites_ReturnsUserFavoritesTrailResponse()
    {
        // Arrange
        var userService = CreateUserService();

        // Act
        var result = await userService.AddTrailToUserFavoritesListAsync(
            "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d", "77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Should().BeOfType<Result<UserFavoritesTrailResponse>>();
    }

    [Fact]
    public async Task AddToUserFavorites_WithInvalidTrailIdentifier_ReturnsNull()
    {
        // Arrange
        var userService = CreateUserService();

        // Act
        var result = await userService.AddTrailToUserFavoritesListAsync(
            "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d", "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Value.Should().BeNull();
    }

    [Fact]
    public async Task AddToUserFavorites_WithInvalidTrailIdentifier_ReturnsCorrectErrorMessage()
    {
        // Arrange
        var userService = CreateUserService();

        // Act
        var result = await userService.AddTrailToUserFavoritesListAsync(
            "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d", "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("Trail with identifier: a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d not found.");
    }

    [Fact]
    public async Task AddTrailToUserFavorites_WithDuplicateTrail_ReturnsFailureResult()
    {
        // Arrange
        var userService = CreateUserService();

        // Act
        var result = await userService.AddTrailToUserFavoritesListAsync(
            "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e", "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Value.Should().BeNull();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(409);
        result.Message.ResultMessage.Should().Be("Trail 11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c already in user favorites");
    }

    [Fact]
    public async Task RemoveTrailFromUserFavorites_ReturnsSuccessResult()
    {
        // Arrange
        var userService = CreateUserService();

        // Act
        var result = await userService.RemoveTrailFromUserFavoritesListAsync(
            "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e", "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c", CancellationToken.None);

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
            "77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c", "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("No user found with identifier 77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c");
    }

    [Fact]
    public async Task RemoveTrailFromUserFavorites_WithInvalidTrailIdentifier_ReturnsCorrectErrorMessage()
    {
        // Arrange
        var userService = CreateUserService();

        // Act
        var result = await userService.RemoveTrailFromUserFavoritesListAsync(
            "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e", "66f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(409);
        result.Message.ResultMessage.Should().Be("Trail 66f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b not in user favorites");
    }

    [Fact]
    public async Task RemoveFromUserFavorites_WhenFavoritesIsNull_ShouldReturnCorrectErrorMessage()
    {
        // Arrange
        var userService = CreateUserService();

        // Act
        var result = await userService.RemoveTrailFromUserFavoritesListAsync(
            "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d22", "77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c", CancellationToken.None);

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
            "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5a33", "77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("User has no favorites");
    }

    [Fact]
    public async Task GetWishListByUserIdentifier_ReturnsOk()
    {
        // Arrange 
        var userService = CreateUserService();

        // Act 
        var result = await userService.GetWishListByUserIdentifierAsync("a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetWishListByUserIdentifier_ReturnsList_WithRightProperties()
    {
        // Arrange 
        var userService = CreateUserService();

        // Act 
        var result = await userService.GetWishListByUserIdentifierAsync("a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull()
                .And.HaveCount(2);

        result.Value.Select(t => t!.Identifier)
                .Should()
                .ContainInOrder(["44d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f", "77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c"]);
        result.Value.Select(t => t!.Name)
                .Should()
                .ContainInOrder(["Vildmarksleden Årås", "Nässehult"]);
    }

    [Fact]
    public async Task GetWishListByUserIdentifier_WhenNoWishlistExists_ReturnsEmptyList()
    {
        // Arrange 
        var userService = CreateUserService();

        // Act 
        var result = await userService.GetWishListByUserIdentifierAsync("b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task GetWishList_WithWrongUserIdentifier_ReturnsNull()
    {
        // Arrange 
        var userService = CreateUserService();

        // Act 
        var result = await userService.GetWishListByUserIdentifierAsync("77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Value.Should().BeNull();
    }

    [Fact]
    public async Task AddToWishList_WithInvalidUserIdentifier_ReturnsCorrectErrorMessage()
    {
        // Arrange 
        var userService = CreateUserService();

        // Act 
        var result = await userService.AddTrailToUserWishListAsync(
          "77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c", "44d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("User with identifier 77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c not found.");
    }

    [Fact]
    public async Task AddTrailToUserWishList_ReturnsUserWishlistTrailResponse()
    {
        // Arrange
        var userService = CreateUserService();

        // Act
        var result = await userService.AddTrailToUserWishListAsync(
            "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e", "44d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f", CancellationToken.None);

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
            "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e", "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("Trail with identifier: a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d not found");
    }

    [Fact]
    public async Task AddTrailToUserWishList_WithDuplicateTrail_ReturnsFailureResult()
    {
        // Arrange
        var userService = CreateUserService();

        // Act
        var result = await userService.AddTrailToUserWishListAsync(
            "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d", "77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Value.Should().BeNull();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(409);
        result.Message.ResultMessage.Should().Be("Trail 77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c already in user wishlist");
    }

    [Fact]
    public async Task RemoveTrailFromUserWishList_ReturnsSuccessResult()
    {
        // Arrange
        var userService = CreateUserService();

        // Act
        var result = await userService.RemoveTrailFromUserWishListAsync(
            "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d", "44d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f", CancellationToken.None);

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
            "77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c", "44d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("No user found with identifier 77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c");
    }

    [Fact]
    public async Task RemoveTrailFromUserWishList_WithInvalidTrailIdentifier_ReturnsCorrectErrorMessage()
    {
        // Arrange
        var userService = CreateUserService();

        // Act
        var result = await userService.RemoveTrailFromUserWishListAsync(
            "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d", "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(409);
        result.Message.ResultMessage.Should().Be("Trail a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d not in user wishlist");
    }
    [Fact]
    public async Task RemoveFromUserWishlist_WhenWishlistIsNull_ShouldReturnCorrectErrorMessage()
    {
        // Arrange
        var userService = CreateUserService();

        // Act
        var result = await userService.RemoveTrailFromUserWishListAsync(
            "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d67", "77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c", CancellationToken.None);

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
            "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5a44", "77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("User has no wishlist");
    }

    private UserService CreateUserService()
    {
        // Mocka factory
        var dbContext = CreateContextAndInMemoryDb();

        var mockContextFactory = new Mock<IDbContextFactory<StigViddDbContext>>();
        mockContextFactory.Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(dbContext);

        // Mocka andra dependencies
        var mockLogger = new Mock<ILogger<UserService>>();
        var mockFavoritesFactory = new Mock<UserFavoritesResponseFactory>();
        var mockWishlistFactory = new Mock<UserWishlistResponseFactory>();
        var mockUserFactory = new Mock<UserResponseFactory>();

        // Skapa service
        var service = new UserService(
            mockContextFactory.Object,
            mockLogger.Object,
            mockFavoritesFactory.Object,
            mockWishlistFactory.Object,
            mockUserFactory.Object
        );

        return service;
    }

    private StigViddDbContext CreateContextAndInMemoryDb()
    {
        // Skapa in-memory databas
        var options = new DbContextOptionsBuilder<StigViddDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        var dbContext = new StigViddDbContext(options);

        Utilities.InitializeDbForTests(dbContext);

        return dbContext;
    }
}
