using Core;
using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Services;
using FluentAssertions;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using WebDataContracts.ResponseModels.User;

namespace UnitTests;

public class UserServiceTests
{
    private const string ValidIdentifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
    private const string ValidFirebaseUid = "firebase-uid-12345";
    private const string ValidTrailIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c";

    private UserService Build(IUserResponseRepository repo) =>
        new(repo, new Mock<ILogger<UserService>>().Object, new UserResponseFactory());

    private static UserResponse StubUser() =>
        UserResponse.Create(ValidIdentifier, "Nick", "nick@test.com", null, null);


    [Fact]
    public async Task GetUserByFirebaseUid_WhenFound_ReturnsSuccess()
    {
        var repo = new Mock<IUserResponseRepository>();
        repo.Setup(r => r.GetUserByFirebaseUidAsync(ValidFirebaseUid, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<UserResponse>.Success(StubUser()));

        var result = await Build(repo.Object).GetUserByFirebaseUidAsync(ValidFirebaseUid, CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task GetUserByFirebaseUid_WhenNotFound_Returns404()
    {
        var repo = new Mock<IUserResponseRepository>();
        repo.Setup(r => r.GetUserByFirebaseUidAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<UserResponse>.NotFound());

        var result = await Build(repo.Object).GetUserByFirebaseUidAsync("no-uid", CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(404);
    }


    [Fact]
    public async Task GetUserIdByIdentifier_WhenFound_ReturnsId()
    {
        var repo = new Mock<IUserResponseRepository>();
        repo.Setup(r => r.GetUserIdByIdentifierAsync(ValidIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(42));

        var result = await Build(repo.Object).GetUserIdByIdentifierAsync(ValidIdentifier, CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Value.Should().Be(42);
    }

    [Fact]
    public async Task GetUserIdByIdentifier_WhenNotFound_Returns404()
    {
        var repo = new Mock<IUserResponseRepository>();
        repo.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

        var result = await Build(repo.Object).GetUserIdByIdentifierAsync("missing", CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(404);
    }


    [Fact]
    public async Task GetUserByIdentifier_WhenFound_ReturnsSuccess()
    {
        var repo = new Mock<IUserResponseRepository>();
        repo.Setup(r => r.GetUserByIdentifierAsync(ValidIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<UserResponse>.Success(StubUser()));

        var result = await Build(repo.Object).GetUserByIdentifierAsync(ValidIdentifier, CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task GetUserByIdentifier_WhenNotFound_Returns404()
    {
        var repo = new Mock<IUserResponseRepository>();
        repo.Setup(r => r.GetUserByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<UserResponse>.NotFound());

        var result = await Build(repo.Object).GetUserByIdentifierAsync("no-user", CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(404);
    }


    [Fact]
    public async Task GetFavoritesByUserIdentifier_WhenHasFavorites_ReturnsList()
    {
        IReadOnlyCollection<UserFavoritesTrailResponse> list =
        [
            UserFavoritesTrailResponse.Create("t1", "Trail", 5M, "Desc", null, null)
        ];
        var repo = new Mock<IUserResponseRepository>();
        repo.Setup(r => r.GetFavoritesByUserIdentifierAsync(ValidIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<UserFavoritesTrailResponse>>.Success(list));

        var result = await Build(repo.Object).GetFavoritesByUserIdentifierAsync(ValidIdentifier, CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Value.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetFavoritesByUserIdentifier_WhenNoFavorites_ReturnsEmptyList()
    {
        var repo = new Mock<IUserResponseRepository>();
        repo.Setup(r => r.GetFavoritesByUserIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<UserFavoritesTrailResponse>>.Success([]));

        var result = await Build(repo.Object).GetFavoritesByUserIdentifierAsync("unknown", CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }


    [Fact]
    public async Task GetWishListByUserIdentifier_WhenHasWishlist_ReturnsList()
    {
        IReadOnlyCollection<UserWishlistTrailResponse> list =
        [
            UserWishlistTrailResponse.Create("t2", "Trail 2", 8M, "Desc", null, null)
        ];
        var repo = new Mock<IUserResponseRepository>();
        repo.Setup(r => r.GetWishListByUserIdentifierAsync(ValidIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<UserWishlistTrailResponse>>.Success(list));

        var result = await Build(repo.Object).GetWishListByUserIdentifierAsync(ValidIdentifier, CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Value.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetWishListByUserIdentifier_WhenNoWishlist_ReturnsEmptyList()
    {
        var repo = new Mock<IUserResponseRepository>();
        repo.Setup(r => r.GetWishListByUserIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<UserWishlistTrailResponse>>.Success([]));

        var result = await Build(repo.Object).GetWishListByUserIdentifierAsync("unknown", CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }


    [Fact]
    public async Task CreateUser_WhenFirebaseUidIsNew_ReturnsSuccess()
    {
        var repo = new Mock<IUserResponseRepository>();
        repo.Setup(r => r.GetUserByFirebaseUidAsync("new-uid", It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<UserResponse>.NotFound());
        repo.Setup(r => r.CreateUserAsync(It.IsAny<User>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((User u, CancellationToken _) => RepositoryResult<User>.Success(u));

        var result = await Build(repo.Object).CreateUserAsync("new@test.com", "NewUser", "new-uid", CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Value!.Email.Should().Be("new@test.com");
        result.Value.NickName.Should().Be("NewUser");
    }

    [Fact]
    public async Task CreateUser_WhenFirebaseUidAlreadyExists_Returns409()
    {
        var repo = new Mock<IUserResponseRepository>();
        repo.Setup(r => r.GetUserByFirebaseUidAsync(ValidFirebaseUid, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<UserResponse>.Success(StubUser()));

        var result = await Build(repo.Object).CreateUserAsync("other@test.com", "Other", ValidFirebaseUid, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(409);
    }


    [Fact]
    public async Task AddTrailToFavorites_WhenSuccess_ReturnsSuccess()
    {
        var response = UserFavoritesTrailResponse.Create(ValidTrailIdentifier, "Trail", 5M, "Desc", null, null);
        var repo = new Mock<IUserResponseRepository>();
        repo.Setup(r => r.AddTrailToUserFavoritesListAsync(ValidIdentifier, ValidTrailIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<UserFavoritesTrailResponse>.Success(response));

        var result = await Build(repo.Object).AddTrailToUserFavoritesListAsync(ValidIdentifier, ValidTrailIdentifier, CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task AddTrailToFavorites_WhenNotFound_Returns404()
    {
        var repo = new Mock<IUserResponseRepository>();
        repo.Setup(r => r.AddTrailToUserFavoritesListAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<UserFavoritesTrailResponse>.NotFound());

        var result = await Build(repo.Object).AddTrailToUserFavoritesListAsync("invalid", "invalid", CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task AddTrailToFavorites_WhenDuplicate_Returns409()
    {
        var repo = new Mock<IUserResponseRepository>();
        repo.Setup(r => r.AddTrailToUserFavoritesListAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<UserFavoritesTrailResponse>.Conflict());

        var result = await Build(repo.Object).AddTrailToUserFavoritesListAsync(ValidIdentifier, ValidTrailIdentifier, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(409);
    }


    [Fact]
    public async Task AddTrailToWishList_WhenSuccess_ReturnsSuccess()
    {
        var response = UserWishlistTrailResponse.Create(ValidTrailIdentifier, "Trail", 5M, "Desc", null, null);
        var repo = new Mock<IUserResponseRepository>();
        repo.Setup(r => r.AddTrailToUserWishListAsync(ValidIdentifier, ValidTrailIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<UserWishlistTrailResponse>.Success(response));

        var result = await Build(repo.Object).AddTrailToUserWishListAsync(ValidIdentifier, ValidTrailIdentifier, CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task AddTrailToWishList_WhenNotFound_Returns404()
    {
        var repo = new Mock<IUserResponseRepository>();
        repo.Setup(r => r.AddTrailToUserWishListAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<UserWishlistTrailResponse>.NotFound());

        var result = await Build(repo.Object).AddTrailToUserWishListAsync("invalid", "invalid", CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task AddTrailToWishList_WhenDuplicate_Returns409()
    {
        var repo = new Mock<IUserResponseRepository>();
        repo.Setup(r => r.AddTrailToUserWishListAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<UserWishlistTrailResponse>.Conflict());

        var result = await Build(repo.Object).AddTrailToUserWishListAsync(ValidIdentifier, ValidTrailIdentifier, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(409);
    }


    [Fact]
    public async Task RemoveFromFavorites_WhenSuccess_ReturnsSuccess()
    {
        var repo = new Mock<IUserResponseRepository>();
        repo.Setup(r => r.RemoveTrailFromUserFavoritesListAsync(ValidIdentifier, ValidTrailIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        var result = await Build(repo.Object).RemoveTrailFromUserFavoritesListAsync(ValidIdentifier, ValidTrailIdentifier, CancellationToken.None);

        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task RemoveFromFavorites_WhenNotFound_Returns404()
    {
        var repo = new Mock<IUserResponseRepository>();
        repo.Setup(r => r.RemoveTrailFromUserFavoritesListAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.NotFound());

        var result = await Build(repo.Object).RemoveTrailFromUserFavoritesListAsync("bad", "bad", CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(404);
    }


    [Fact]
    public async Task RemoveFromWishList_WhenSuccess_ReturnsSuccess()
    {
        var repo = new Mock<IUserResponseRepository>();
        repo.Setup(r => r.RemoveTrailFromUserWishListAsync(ValidIdentifier, ValidTrailIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        var result = await Build(repo.Object).RemoveTrailFromUserWishListAsync(ValidIdentifier, ValidTrailIdentifier, CancellationToken.None);

        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task RemoveFromWishList_WhenNotFound_Returns404()
    {
        var repo = new Mock<IUserResponseRepository>();
        repo.Setup(r => r.RemoveTrailFromUserWishListAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.NotFound());

        var result = await Build(repo.Object).RemoveTrailFromUserWishListAsync("bad", "bad", CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(404);
    }


    [Fact]
    public async Task DeleteUser_WhenFound_ReturnsSuccess()
    {
        var repo = new Mock<IUserResponseRepository>();
        repo.Setup(r => r.DeleteUserAsync(ValidIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        var result = await Build(repo.Object).DeleteUserAsync(ValidIdentifier, CancellationToken.None);

        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteUser_WhenNotFound_Returns404()
    {
        var repo = new Mock<IUserResponseRepository>();
        repo.Setup(r => r.DeleteUserAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.NotFound());

        var result = await Build(repo.Object).DeleteUserAsync("nobody", CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task DeleteUser_WhenExceptionThrown_Returns500()
    {
        var repo = new Mock<IUserResponseRepository>();
        repo.Setup(r => r.DeleteUserAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("DB error"));

        var result = await Build(repo.Object).DeleteUserAsync(ValidIdentifier, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(500);
    }
}
