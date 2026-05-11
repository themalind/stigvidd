using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Services;
using FluentAssertions;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Configuration;
using Moq;
using System.Linq.Expressions;
using WebDataContracts.ResponseModels.User;

namespace UnitTests.ServiceTests;

public class UserServiceTests
{
    private UserService Build(IUserRepository repo)
    {
        var cfg = new Mock<IConfiguration>();
        cfg.Setup(c => c["PresentableBaseUrl"]).Returns("http://stigvidd.se/testing/");
        var trailobstacleRepo = new Mock<ITrailObstacleRepository>();
        return new UserService(repo, trailobstacleRepo.Object, new UserResponseFactory(cfg.Object));
    }

    [Fact]
    public async Task GetUserByFirebaseUid_WhenFound_ReturnsSuccess()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.GetUserByFirebaseUidAsync(Utilities.Identifiers.UserFirebaseUid, It.IsAny<Expression<Func<User, UserResponse>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<UserResponse>.Success(Utilities.Stubs.UserResponse()));

        // Act
        var result = await Build(repo.Object).GetUserByFirebaseUidAsync(Utilities.Identifiers.UserFirebaseUid, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task GetUserByFirebaseUid_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.GetUserByFirebaseUidAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, UserResponse>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<UserResponse>.NotFound());

        // Act
        var result = await Build(repo.Object).GetUserByFirebaseUidAsync("no-uid", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task GetUserIdByIdentifier_WhenFound_ReturnsId()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.GetUserIdByIdentifierAsync(Utilities.Identifiers.User, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(42));

        // Act
        var result = await Build(repo.Object).GetUserIdByIdentifierAsync(Utilities.Identifiers.User, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().Be(42);
    }

    [Fact]
    public async Task GetUserIdByIdentifier_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

        // Act
        var result = await Build(repo.Object).GetUserIdByIdentifierAsync("missing", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task GetUserByIdentifier_WhenFound_ReturnsSuccess()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.GetUserByIdentifierAsync(Utilities.Identifiers.User, It.IsAny<Expression<Func<User, UserResponse>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<UserResponse>.Success(Utilities.Stubs.UserResponse()));

        // Act
        var result = await Build(repo.Object).GetUserByIdentifierAsync(Utilities.Identifiers.User, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task GetUserByIdentifier_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.GetUserByIdentifierAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, UserResponse>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<UserResponse>.NotFound());

        // Act
        var result = await Build(repo.Object).GetUserByIdentifierAsync("no-user", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task GetFavoritesByUserIdentifier_WhenHasFavorites_ReturnsList()
    {
        // Arrange
        IReadOnlyCollection<UserFavoritesTrailResponse> list =
        [
            UserFavoritesTrailResponse.Create("t1", "Trail", 5M, "Desc", null, null)
        ];
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.GetFavoritesByUserIdentifierAsync(Utilities.Identifiers.User, It.IsAny<Expression<Func<Trail, UserFavoritesTrailResponse>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<UserFavoritesTrailResponse>>.Success(list));

        // Act
        var result = await Build(repo.Object).GetFavoritesByUserIdentifierAsync(Utilities.Identifiers.User, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetFavoritesByUserIdentifier_WhenNoFavorites_ReturnsEmptyList()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.GetFavoritesByUserIdentifierAsync(
            Utilities.Identifiers.UserWithNoFavorites,
            It.IsAny<Expression<Func<Trail,
            UserFavoritesTrailResponse>>>(),
            It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<UserFavoritesTrailResponse>>.Success([]));

        // Act
        var result = await Build(repo.Object).GetFavoritesByUserIdentifierAsync(Utilities.Identifiers.UserWithNoFavorites, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task GetWishListByUserIdentifier_WhenHasWishlist_ReturnsList()
    {
        // Arrange
        IReadOnlyCollection<UserWishlistTrailResponse> list =
        [
            UserWishlistTrailResponse.Create("t2", "Trail 2", 8M, "Desc", null, null)
        ];
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.GetWishListByUserIdentifierAsync(Utilities.Identifiers.User, It.IsAny<Expression<Func<Trail, UserWishlistTrailResponse>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<UserWishlistTrailResponse>>.Success(list));

        // Act
        var result = await Build(repo.Object).GetWishListByUserIdentifierAsync(Utilities.Identifiers.User, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetWishListByUserIdentifier_WhenNoWishlist_ReturnsEmptyList()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.GetWishListByUserIdentifierAsync(Utilities.Identifiers.UserWithNoWishlist, It.IsAny<Expression<Func<Trail, UserWishlistTrailResponse>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<UserWishlistTrailResponse>>.Success([]));

        // Act
        var result = await Build(repo.Object).GetWishListByUserIdentifierAsync(Utilities.Identifiers.UserWithNoWishlist, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateUser_WhenFirebaseUidIsNew_ReturnsSuccess()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.GetUserByFirebaseUidAsync("new-uid", It.IsAny<Expression<Func<User, string>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<string>.NotFound());
        repo.Setup(r => r.CreateUserAsync(It.IsAny<User>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((User u, CancellationToken _) => RepositoryResult<User>.Success(u));

        // Act
        var result = await Build(repo.Object).CreateUserAsync("new@test.com", "NewUser", "new-uid", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Email.Should().Be("new@test.com");
        result.Value.NickName.Should().Be("NewUser");
    }

    [Fact]
    public async Task CreateUser_WhenFirebaseUidAlreadyExists_ReturnsConflict()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.GetUserByFirebaseUidAsync(Utilities.Identifiers.UserFirebaseUid, It.IsAny<Expression<Func<User, string>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<string>.Success(Utilities.Identifiers.User));

        // Act
        var result = await Build(repo.Object).CreateUserAsync("other@test.com", "Other", Utilities.Identifiers.UserFirebaseUid, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task AddTrailToFavorites_WhenSuccess_ReturnsSuccess()
    {
        // Arrange
        var response = UserFavoritesTrailResponse.Create(Utilities.Identifiers.Trail1, "Trail", 5M, "Desc", null, null);
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.AddTrailToUserFavoritesListAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail1, It.IsAny<Expression<Func<Trail, UserFavoritesTrailResponse>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<UserFavoritesTrailResponse>.Success(response));

        // Act
        var result = await Build(repo.Object).AddTrailToUserFavoritesListAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail1, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task AddTrailToFavorites_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.AddTrailToUserFavoritesListAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Expression<Func<Trail, UserFavoritesTrailResponse>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<UserFavoritesTrailResponse>.NotFound());

        // Act
        var result = await Build(repo.Object).AddTrailToUserFavoritesListAsync("invalid", "invalid", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task AddTrailToFavorites_WhenDuplicate_ReturnsConflict()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.AddTrailToUserFavoritesListAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Expression<Func<Trail, UserFavoritesTrailResponse>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<UserFavoritesTrailResponse>.Conflict());

        // Act
        var result = await Build(repo.Object).AddTrailToUserFavoritesListAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail1, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task AddTrailToWishList_WhenSuccess_ReturnsSuccess()
    {
        // Arrange
        var response = UserWishlistTrailResponse.Create(Utilities.Identifiers.Trail1, "Trail", 5M, "Desc", null, null);
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.AddTrailToUserWishListAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail1, It.IsAny<Expression<Func<Trail, UserWishlistTrailResponse>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<UserWishlistTrailResponse>.Success(response));

        // Act
        var result = await Build(repo.Object).AddTrailToUserWishListAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail1, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task AddTrailToWishList_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.AddTrailToUserWishListAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Expression<Func<Trail, UserWishlistTrailResponse>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<UserWishlistTrailResponse>.NotFound());

        // Act
        var result = await Build(repo.Object).AddTrailToUserWishListAsync("invalid", "invalid", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task AddTrailToWishList_WhenDuplicate_ReturnsConflict()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.AddTrailToUserWishListAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Expression<Func<Trail, UserWishlistTrailResponse>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<UserWishlistTrailResponse>.Conflict());

        // Act
        var result = await Build(repo.Object).AddTrailToUserWishListAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail1, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task RemoveFromFavorites_WhenSuccess_ReturnsSuccess()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.RemoveTrailFromUserFavoritesListAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        // Act
        var result = await Build(repo.Object).RemoveTrailFromUserFavoritesListAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail1, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task RemoveFromFavorites_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.RemoveTrailFromUserFavoritesListAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.NotFound());

        // Act
        var result = await Build(repo.Object).RemoveTrailFromUserFavoritesListAsync("bad", "bad", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task RemoveFromWishList_WhenSuccess_ReturnsSuccess()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.RemoveTrailFromUserWishListAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        // Act
        var result = await Build(repo.Object).RemoveTrailFromUserWishListAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail1, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task RemoveFromWishList_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.RemoveTrailFromUserWishListAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.NotFound());

        // Act
        var result = await Build(repo.Object).RemoveTrailFromUserWishListAsync("bad", "bad", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task DeleteUser_WhenFound_ReturnsSuccess()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.DeleteUserAsync(Utilities.Identifiers.User, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        // Act
        var result = await Build(repo.Object).DeleteUserAsync(Utilities.Identifiers.User, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteUser_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.DeleteUserAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.NotFound());

        // Act
        var result = await Build(repo.Object).DeleteUserAsync("nobody", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task DeleteUser_WhenExceptionThrown_ReturnsInternalServerError()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.DeleteUserAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Error());

        // Act
        var result = await Build(repo.Object).DeleteUserAsync(Utilities.Identifiers.User, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }
}
