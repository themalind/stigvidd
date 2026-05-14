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
    private UserService Build(
        Mock<IUserRepository>? repo = null,
        Mock<IHikeRepository>? hikeRepo = null,
        Mock<ITrailObstacleRepository>? trailobstacleRepo = null,
        Mock<IFriendRepository>? friendRepo = null)
    {
        var cfg = new Mock<IConfiguration>();
        cfg.Setup(c => c["PresentableBaseUrl"]).Returns("http://stigvidd.se/testing/");
        repo ??= new Mock<IUserRepository>();
        friendRepo ??= new Mock<IFriendRepository>();
        var userResponseFactory = new UserResponseFactory(cfg.Object);
        trailobstacleRepo ??= new Mock<ITrailObstacleRepository>();
        hikeRepo ??= new Mock<IHikeRepository>();

        return new UserService(repo.Object, trailobstacleRepo.Object, userResponseFactory, hikeRepo.Object, friendRepo.Object);
    }

    [Fact]
    public async Task GetUserByFirebaseUid_WhenFound_ReturnsSuccess()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.GetUserByFirebaseUidAsync(Utilities.Identifiers.UserFirebaseUid, It.IsAny<Expression<Func<User, UserResponse>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<UserResponse>.Success(Utilities.Stubs.UserResponse()));

        // Act
        var result = await Build(repo).GetUserByFirebaseUidAsync(Utilities.Identifiers.UserFirebaseUid, CancellationToken.None);

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
        var result = await Build(repo).GetUserByFirebaseUidAsync("no-uid", CancellationToken.None);

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
        var result = await Build(repo).GetUserIdByIdentifierAsync(Utilities.Identifiers.User, CancellationToken.None);

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
        var result = await Build(repo).GetUserIdByIdentifierAsync("missing", CancellationToken.None);

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
        var result = await Build(repo).GetUserByIdentifierAsync(Utilities.Identifiers.User, CancellationToken.None);

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
        var result = await Build(repo).GetUserByIdentifierAsync("no-user", CancellationToken.None);

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
        var result = await Build(repo).GetFavoritesByUserIdentifierAsync(Utilities.Identifiers.User, CancellationToken.None);

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
        var result = await Build(repo).GetFavoritesByUserIdentifierAsync(Utilities.Identifiers.UserWithNoFavorites, CancellationToken.None);

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
        var result = await Build(repo).GetWishListByUserIdentifierAsync(Utilities.Identifiers.User, CancellationToken.None);

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
        var result = await Build(repo).GetWishListByUserIdentifierAsync(Utilities.Identifiers.UserWithNoWishlist, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateUser_WhenFirebaseUidIsNew_ReturnsSuccess()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.CheckUserNicknameAvaliability(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());
        repo.Setup(r => r.GetUserByFirebaseUidAsync("new-uid", It.IsAny<Expression<Func<User, string>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<string>.NotFound());
        repo.Setup(r => r.CreateUserAsync(It.IsAny<User>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((User u, CancellationToken _) => RepositoryResult<User>.Success(u));

        // Act
        var result = await Build(repo).CreateUserAsync("new@test.com", "NewUser", "new-uid", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Email.Should().Be("new@test.com");
        result.Value.NickName.Should().Be("NewUser");
    }

    [Fact]
    public async Task CreateUser_WhenNicknameAlreadyTaken_ReturnsConflict()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.CheckUserNicknameAvaliability(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Conflict());

        // Act
        var result = await Build(repo).CreateUserAsync("new@test.com", "TakenNickname", "new-uid", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task CreateUser_WhenFirebaseUidAlreadyExists_ReturnsConflict()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.CheckUserNicknameAvaliability(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());
        repo.Setup(r => r.GetUserByFirebaseUidAsync(Utilities.Identifiers.UserFirebaseUid, It.IsAny<Expression<Func<User, string>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<string>.Success(Utilities.Identifiers.User));

        // Act
        var result = await Build(repo).CreateUserAsync("other@test.com", "Other", Utilities.Identifiers.UserFirebaseUid, CancellationToken.None);

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
        var result = await Build(repo).AddTrailToUserFavoritesListAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail1, CancellationToken.None);

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
        var result = await Build(repo).AddTrailToUserFavoritesListAsync("invalid", "invalid", CancellationToken.None);

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
        var result = await Build(repo).AddTrailToUserFavoritesListAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail1, CancellationToken.None);

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
        var result = await Build(repo).AddTrailToUserWishListAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail1, CancellationToken.None);

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
        var result = await Build(repo).AddTrailToUserWishListAsync("invalid", "invalid", CancellationToken.None);

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
        var result = await Build(repo).AddTrailToUserWishListAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail1, CancellationToken.None);

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
        var result = await Build(repo).RemoveTrailFromUserFavoritesListAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail1, CancellationToken.None);

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
        var result = await Build(repo).RemoveTrailFromUserFavoritesListAsync("bad", "bad", CancellationToken.None);

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
        var result = await Build(repo).RemoveTrailFromUserWishListAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail1, CancellationToken.None);

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
        var result = await Build(repo).RemoveTrailFromUserWishListAsync("bad", "bad", CancellationToken.None);

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
        repo.Setup(r => r.GetUserIdByIdentifierAsync(Utilities.Identifiers.User, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));
        repo.Setup(r => r.DeleteUserAsync(Utilities.Identifiers.User, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());
        var hikeRepo = new Mock<IHikeRepository>();
        hikeRepo.Setup(r => r.HandleUserHikesOnUserDeleteAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());
        hikeRepo.Setup(hr => hr.DeleteHikeSharesByUserIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());
        var trailObstacleRepo = new Mock<ITrailObstacleRepository>();
        trailObstacleRepo.Setup(r => r.DeleteAllObstaclesByUserIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());
        var friendRepo = new Mock<IFriendRepository>();
        friendRepo.Setup(r => r.DeleteAllFriendRequestsByUserIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        // Act
        var result = await Build(repo, hikeRepo, trailObstacleRepo, friendRepo).DeleteUserAsync(Utilities.Identifiers.User, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteUser_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.NotFound());
        var hikeRepo = new Mock<IHikeRepository>();
        var trailObstacleRepo = new Mock<ITrailObstacleRepository>();

        // Act
        var result = await Build(repo, hikeRepo, trailObstacleRepo).DeleteUserAsync("nobody", CancellationToken.None);

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
        repo.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Error());
        var hikeRepo = new Mock<IHikeRepository>();
        var trailObstacleRepo = new Mock<ITrailObstacleRepository>();

        // Act
        var result = await Build(repo, hikeRepo, trailObstacleRepo).DeleteUserAsync(Utilities.Identifiers.User, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }
}
