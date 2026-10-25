// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Factories;
using Core.Telemetry;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Core.Services;
using AwesomeAssertions;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Configuration;
using Moq;
using System.Linq.Expressions;
using WebDataContracts.ResponseModels.Friend;
using WebDataContracts.ResponseModels.User;
using Microsoft.Extensions.Logging.Abstractions;

namespace UnitTests.ServiceTests;

public class UserServiceTests
{
    private UserService Build(
        Mock<IUserRepository>? repo = null,
        Mock<IAccountDeletionRepository>? accountDeletionRepo = null,
        Mock<IHikeService>? hikeService = null,
        Mock<IWebDavService>? webDav = null,
        StigviddMetrics? metrics = null,
        Mock<IUserBlockService>? userBlockService = null)
    {
        var cfg = new Mock<IConfiguration>();
        cfg.Setup(c => c["PresentableBaseUrl"]).Returns("http://stigvidd.se/testing/");
        repo ??= new Mock<IUserRepository>();
        accountDeletionRepo ??= new Mock<IAccountDeletionRepository>();
        hikeService ??= new Mock<IHikeService>();
        webDav ??= Utilities.MockFactory.WebDavService();
        var userResponseFactory = new UserResponseFactory(cfg.Object);

        return new UserService(repo.Object, accountDeletionRepo.Object, userResponseFactory, hikeService.Object, webDav.Object, (userBlockService ?? Utilities.MockFactory.UserBlockServiceHiding()).Object, metrics ?? new StigviddMetrics(), NullLogger<UserService>.Instance);
    }

    private static Mock<IAccountDeletionRepository> DeletesAccount(params string[] fileUrls)
    {
        var repo = new Mock<IAccountDeletionRepository>();
        repo.Setup(r => r.DeleteAccountAsync(Utilities.Identifiers.User, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<DeletedAccount>.Success(new DeletedAccount(1, fileUrls)));
        return repo;
    }

    [Fact]
    public async Task GetUserBySubjectId_WhenFound_ReturnsSuccess()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.GetUserBySubjectAsync(Utilities.Identifiers.UserSubjectId, It.IsAny<Expression<Func<User, UserResponse>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<UserResponse>.Success(
                UserResponse.Create(Utilities.Identifiers.User, "Nick", "nick@test.com")));

        // Act
        var result = await Build(repo).GetUserBySubjectAsync(Utilities.Identifiers.UserSubjectId, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
    }

    // A ban is read-only, so the lookup every authenticated route goes through must still
    // succeed -- it is BannedAt riding along that the write filter and the app act on.
    [Fact]
    public async Task GetUserBySubjectId_WhenTheAccountIsBanned_StillReturnsTheUserWithTheBan()
    {
        // Arrange
        var bannedAt = new DateTime(2026, 2, 3, 4, 5, 6, DateTimeKind.Utc);
        var repo = new Mock<IUserRepository>();
        var entity = new User { NickName = "Nick", Email = "nick@test.com", SubjectId = "subject" };
        entity.Bans.Add(new UserBan { BannedBy = "moderator", BannedAt = bannedAt, LiftedAt = bannedAt.AddDays(-30) });
        entity.Bans.Add(new UserBan { BannedBy = "moderator", BannedAt = bannedAt });
        repo.Setup(r => r.GetUserBySubjectAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, UserResponse>>>(), It.IsAny<CancellationToken>()))
            .Returns((string _, Expression<Func<User, UserResponse>> selector, CancellationToken _) =>
                Task.FromResult(RepositoryResult<UserResponse>.Success(selector.Compile()(entity))));

        // Act
        var result = await Build(repo).GetUserBySubjectAsync(Utilities.Identifiers.UserSubjectId, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.BannedAt.Should().Be(bannedAt);
    }

    [Fact]
    public async Task GetUserBySubjectId_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.GetUserBySubjectAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, UserResponse>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<UserResponse>.NotFound());

        // Act
        var result = await Build(repo).GetUserBySubjectAsync("no-uid", TestContext.Current.CancellationToken);

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
        var result = await Build(repo).GetUserIdByIdentifierAsync(Utilities.Identifiers.User, TestContext.Current.CancellationToken);

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
        var result = await Build(repo).GetUserIdByIdentifierAsync("missing", TestContext.Current.CancellationToken);

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
        var result = await Build(repo).GetUserByIdentifierAsync(Utilities.Identifiers.User, TestContext.Current.CancellationToken);

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
        var result = await Build(repo).GetUserByIdentifierAsync("no-user", TestContext.Current.CancellationToken);

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
            UserFavoritesTrailResponse.Create("t1", "Trail", 5M, "Borås", 1, false, null, null,null, null)
        ];
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.GetFavoritesByUserIdentifierAsync(Utilities.Identifiers.User, It.IsAny<Expression<Func<Trail, UserFavoritesTrailResponse>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<UserFavoritesTrailResponse>>.Success(list));

        // Act
        var result = await Build(repo).GetFavoritesByUserIdentifierAsync(Utilities.Identifiers.User, TestContext.Current.CancellationToken);

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
        var result = await Build(repo).GetFavoritesByUserIdentifierAsync(Utilities.Identifiers.UserWithNoFavorites, TestContext.Current.CancellationToken);

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
            UserWishlistTrailResponse.Create("t2", "Trail 2", 8M, "Borås", 1, false, null, null,null, null)
        ];
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.GetWishListByUserIdentifierAsync(Utilities.Identifiers.User, It.IsAny<Expression<Func<Trail, UserWishlistTrailResponse>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<UserWishlistTrailResponse>>.Success(list));

        // Act
        var result = await Build(repo).GetWishListByUserIdentifierAsync(Utilities.Identifiers.User, TestContext.Current.CancellationToken);

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
        var result = await Build(repo).GetWishListByUserIdentifierAsync(Utilities.Identifiers.UserWithNoWishlist, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateUser_WhenSubjectIdIsNew_ReturnsSuccess()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.CheckUserNicknameAvaliability(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());
        repo.Setup(r => r.GetUserBySubjectAsync("new-uid", It.IsAny<Expression<Func<User, string>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<string>.NotFound());
        repo.Setup(r => r.CreateUserAsync(It.IsAny<User>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((User u, CancellationToken _) => RepositoryResult<User>.Success(u));

        // Act
        var result = await Build(repo).CreateUserAsync("new@test.com", "NewUser", "new-uid", TestContext.Current.CancellationToken);

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
        var result = await Build(repo).CreateUserAsync("new@test.com", "TakenNickname", "new-uid", TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task CreateUser_WhenSubjectIdAlreadyExists_ReturnsConflict()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.CheckUserNicknameAvaliability(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());
        repo.Setup(r => r.GetUserBySubjectAsync(Utilities.Identifiers.UserSubjectId, It.IsAny<Expression<Func<User, string>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<string>.Success(Utilities.Identifiers.User));

        // Act
        var result = await Build(repo).CreateUserAsync("other@test.com", "Other", Utilities.Identifiers.UserSubjectId, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task AddTrailToFavorites_WhenSuccess_ReturnsSuccess()
    {
        // Arrange
        var response = UserFavoritesTrailResponse.Create(Utilities.Identifiers.Trail1, "Trail", 5M, "Borås", 1, false, null, null,null, null);
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.AddTrailToUserFavoritesListAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail1, It.IsAny<Expression<Func<Trail, UserFavoritesTrailResponse>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<UserFavoritesTrailResponse>.Success(response));

        // Act
        var result = await Build(repo).AddTrailToUserFavoritesListAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail1, TestContext.Current.CancellationToken);

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
        var result = await Build(repo).AddTrailToUserFavoritesListAsync("invalid", "invalid", TestContext.Current.CancellationToken);

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
        var result = await Build(repo).AddTrailToUserFavoritesListAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail1, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task AddTrailToWishList_WhenSuccess_ReturnsSuccess()
    {
        // Arrange
        var response = UserWishlistTrailResponse.Create(Utilities.Identifiers.Trail1, "Trail", 5M, "Borås", 1, false, null, null,null, null);
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.AddTrailToUserWishListAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail1, It.IsAny<Expression<Func<Trail, UserWishlistTrailResponse>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<UserWishlistTrailResponse>.Success(response));

        // Act
        var result = await Build(repo).AddTrailToUserWishListAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail1, TestContext.Current.CancellationToken);

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
        var result = await Build(repo).AddTrailToUserWishListAsync("invalid", "invalid", TestContext.Current.CancellationToken);

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
        var result = await Build(repo).AddTrailToUserWishListAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail1, TestContext.Current.CancellationToken);

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
        var result = await Build(repo).RemoveTrailFromUserFavoritesListAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail1, TestContext.Current.CancellationToken);

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
        var result = await Build(repo).RemoveTrailFromUserFavoritesListAsync("bad", "bad", TestContext.Current.CancellationToken);

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
        var result = await Build(repo).RemoveTrailFromUserWishListAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail1, TestContext.Current.CancellationToken);

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
        var result = await Build(repo).RemoveTrailFromUserWishListAsync("bad", "bad", TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task DeleteUser_WhenFound_ReturnsSuccess()
    {
        // Act
        var result = await Build(accountDeletionRepo: DeletesAccount()).DeleteUserAsync(Utilities.Identifiers.User, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteUser_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var accountDeletionRepo = new Mock<IAccountDeletionRepository>();
        accountDeletionRepo.Setup(r => r.DeleteAccountAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<DeletedAccount>.NotFound());

        // Act
        var result = await Build(accountDeletionRepo: accountDeletionRepo).DeleteUserAsync("nobody", TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task DeleteUser_WhenTheDeletionRollsBack_ReturnsInternalServerErrorAndTouchesNoFile()
    {
        // Arrange
        var accountDeletionRepo = new Mock<IAccountDeletionRepository>();
        accountDeletionRepo.Setup(r => r.DeleteAccountAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<DeletedAccount>.Error());
        var webDav = Utilities.MockFactory.WebDavService();
        var hikeService = new Mock<IHikeService>();

        // Act
        var result = await Build(accountDeletionRepo: accountDeletionRepo, hikeService: hikeService, webDav: webDav)
            .DeleteUserAsync(Utilities.Identifiers.User, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
        webDav.Verify(w => w.DeleteFileAsync(It.IsAny<string>()), Times.Never);
        hikeService.Verify(s => s.CleanUpOrphanedHikesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task DeleteUser_DeletesTheFilesAfterTheRowsAndThenSweepsOrphanedHikes()
    {
        // Arrange
        var order = new List<string>();
        var accountDeletionRepo = new Mock<IAccountDeletionRepository>();
        accountDeletionRepo.Setup(r => r.DeleteAccountAsync(Utilities.Identifiers.User, It.IsAny<CancellationToken>()))
            .Callback(() => order.Add("rows"))
            .ReturnsAsync(RepositoryResult<DeletedAccount>.Success(new DeletedAccount(1, ["hikes/a.jpeg", "reviews/b.jpeg"])));
        var webDav = Utilities.MockFactory.WebDavService();
        webDav.Setup(w => w.DeleteFileAsync(It.IsAny<string>()))
            .Callback<string>(url => order.Add(url))
            .ReturnsAsync(Result.Ok(true));
        var hikeService = new Mock<IHikeService>();
        hikeService.Setup(s => s.CleanUpOrphanedHikesAsync(It.IsAny<CancellationToken>()))
            .Callback(() => order.Add("sweep"))
            .Returns(Task.CompletedTask);

        // Act
        var result = await Build(accountDeletionRepo: accountDeletionRepo, hikeService: hikeService, webDav: webDav)
            .DeleteUserAsync(Utilities.Identifiers.User, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        order.Should().Equal("rows", "hikes/a.jpeg", "reviews/b.jpeg", "sweep");
    }

    [Fact]
    public async Task DeleteUser_WhenWebDavThrows_StillSucceedsAndTriesEveryFile()
    {
        // Arrange — the account is already gone; a leftover file must not turn that into an error
        var webDav = Utilities.MockFactory.WebDavService();
        webDav.Setup(w => w.DeleteFileAsync(It.IsAny<string>()))
            .ThrowsAsync(new Exception("webdav down"));

        // Act
        var result = await Build(accountDeletionRepo: DeletesAccount("hikes/a.jpeg", "reviews/b.jpeg"), webDav: webDav)
            .DeleteUserAsync(Utilities.Identifiers.User, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        webDav.Verify(w => w.DeleteFileAsync(It.IsAny<string>()), Times.Exactly(2));
    }

    [Fact]
    public async Task DeleteUser_WhenWebDavRefuses_StillSucceeds()
    {
        // Arrange
        var webDav = Utilities.MockFactory.WebDavService();
        webDav.Setup(w => w.DeleteFileAsync(It.IsAny<string>()))
            .ReturnsAsync(Result.Fail<bool>(new Message(500, "refused")));

        // Act
        var result = await Build(accountDeletionRepo: DeletesAccount("hikes/a.jpeg"), webDav: webDav)
            .DeleteUserAsync(Utilities.Identifiers.User, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task FindUsersByNickName_WhenMatchesFound_ReturnsList()
    {
        // Arrange
        IReadOnlyCollection<SearchFriendResultResponse> matches =
        [
            SearchFriendResultResponse.Create("id-1", "alice"),
            SearchFriendResultResponse.Create("id-2", "alicia"),
        ];
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.FindUsersByNickNameAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<int[]>(),
                It.IsAny<Expression<Func<User, SearchFriendResultResponse>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<SearchFriendResultResponse>>.Success(matches));

        // Act
        var result = await Build(repo).FindUsersByNickNameAsync("ali", Utilities.Identifiers.User, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().HaveCount(2);
    }

    [Fact]
    public async Task FindUsersByNickName_WhenNoMatches_ReturnsEmptyList()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.FindUsersByNickNameAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<int[]>(),
                It.IsAny<Expression<Func<User, SearchFriendResultResponse>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<SearchFriendResultResponse>>.NotFound());

        // Act
        var result = await Build(repo).FindUsersByNickNameAsync("ghost", Utilities.Identifiers.User, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task FindUsersByNickName_WhenRepositoryErrors_ReturnsInternalServerError()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.FindUsersByNickNameAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<int[]>(),
                It.IsAny<Expression<Func<User, SearchFriendResultResponse>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<SearchFriendResultResponse>>.Error());

        // Act
        var result = await Build(repo).FindUsersByNickNameAsync("ali", Utilities.Identifiers.User, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    // The block hides the person from search too, so the only way back to them is unblocking.
    [Fact]
    public async Task FindUsersByNickName_PassesTheBlockedIdsToTheQuery()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.FindUsersByNickNameAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<int[]>(),
                It.IsAny<Expression<Func<User, SearchFriendResultResponse>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<SearchFriendResultResponse>>.Success([]));

        var blocks = Utilities.MockFactory.UserBlockServiceHiding(7, 9);

        // Act
        await Build(repo, userBlockService: blocks).FindUsersByNickNameAsync(
            "ali", Utilities.Identifiers.User, TestContext.Current.CancellationToken);

        // Assert
        repo.Verify(r => r.FindUsersByNickNameAsync(
            "ali",
            Utilities.Identifiers.User,
            It.Is<int[]>(ids => ids.Contains(7) && ids.Contains(9)),
            It.IsAny<Expression<Func<User, SearchFriendResultResponse>>>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }
}
