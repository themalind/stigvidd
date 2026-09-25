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

namespace UnitTests.ServiceTests;

public class UserServiceTests
{
    private UserService Build(
        Mock<IUserRepository>? repo = null,
        Mock<IHikeService>? hikeService = null,
        Mock<ITrailObstacleRepository>? trailobstacleRepo = null,
        Mock<IFriendRepository>? friendRepo = null,
        Mock<IReviewService>? reviewService = null,
        Mock<IContentReportRepository>? contentReportRepo = null,
        Mock<IMailOutboxRepository>? mailOutboxRepo = null,
        StigviddMetrics? metrics = null,
        Mock<IUserBlockService>? userBlockService = null)
    {
        var cfg = new Mock<IConfiguration>();
        cfg.Setup(c => c["PresentableBaseUrl"]).Returns("http://stigvidd.se/testing/");
        repo ??= new Mock<IUserRepository>();
        friendRepo ??= new Mock<IFriendRepository>();
        var userResponseFactory = new UserResponseFactory(cfg.Object);
        trailobstacleRepo ??= new Mock<ITrailObstacleRepository>();
        hikeService ??= new Mock<IHikeService>();
        // Reports are settled on the way to every user deletion; tests that care pass their own
        contentReportRepo ??= new Mock<IContentReportRepository>();
        contentReportRepo.Setup(r => r.HandleUserDeletionAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());
        // The address is read on the way to every user deletion, to erase that person's mail --
        // the outbox has no foreign key to Users, so the address is the only handle on it. The
        // <string> overload is distinct from the <UserResponse> one the read tests set up.
        repo.Setup(r => r.GetUserByIdentifierAsync(
                It.IsAny<string>(),
                It.IsAny<Expression<Func<User, string>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<string>.Success("vandrare@example.com"));

        // Queued mail is erased on the way to every user deletion; tests that care pass their own
        mailOutboxRepo ??= new Mock<IMailOutboxRepository>();
        mailOutboxRepo.Setup(r => r.EraseByRecipientAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(0));
        if (reviewService is null)
        {
            // Reviews are anonymized on the way to every user deletion; tests that care pass their own
            reviewService = new Mock<IReviewService>();
            reviewService.Setup(s => s.AnonymizeUserReviewsOnUserDeleteAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(Result.Ok());
        }

        return new UserService(repo.Object, trailobstacleRepo.Object, userResponseFactory, hikeService.Object, reviewService.Object, friendRepo.Object, (userBlockService ?? Utilities.MockFactory.UserBlockServiceHiding()).Object, contentReportRepo.Object, mailOutboxRepo.Object, metrics ?? new StigviddMetrics());
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
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.GetUserIdByIdentifierAsync(Utilities.Identifiers.User, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));
        repo.Setup(r => r.DeleteUserAsync(Utilities.Identifiers.User, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());
        var hikeService = new Mock<IHikeService>();
        hikeService.Setup(s => s.HandleUserHikesOnUserDeleteAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());
        hikeService.Setup(hs => hs.DeleteHikeSharesByUserIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());
        var trailObstacleRepo = new Mock<ITrailObstacleRepository>();
        trailObstacleRepo.Setup(r => r.AnonymizeObstaclesByUserIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());
        var friendRepo = new Mock<IFriendRepository>();
        friendRepo.Setup(r => r.DeleteAllFriendRequestsByUserIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        // Act
        var result = await Build(repo, hikeService, trailObstacleRepo, friendRepo).DeleteUserAsync(Utilities.Identifiers.User, TestContext.Current.CancellationToken);

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
        var hikeService = new Mock<IHikeService>();
        var trailObstacleRepo = new Mock<ITrailObstacleRepository>();

        // Act
        var result = await Build(repo, hikeService, trailObstacleRepo).DeleteUserAsync("nobody", TestContext.Current.CancellationToken);

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
        var hikeService = new Mock<IHikeService>();
        var trailObstacleRepo = new Mock<ITrailObstacleRepository>();

        // Act
        var result = await Build(repo, hikeService, trailObstacleRepo).DeleteUserAsync(Utilities.Identifiers.User, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task DeleteUser_WhenHandleUserHikesFails_ReturnsInternalServerError()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));
        var hikeService = new Mock<IHikeService>();
        hikeService.Setup(s => s.HandleUserHikesOnUserDeleteAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Fail(new Message(500, "hike cleanup failed")));
        var trailObstacleRepo = new Mock<ITrailObstacleRepository>();

        // Act
        var result = await Build(repo, hikeService, trailObstacleRepo).DeleteUserAsync(Utilities.Identifiers.User, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task DeleteUser_WhenAnonymizeUserReviewsFails_ReturnsInternalServerError()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));
        var hikeService = new Mock<IHikeService>();
        hikeService.Setup(s => s.HandleUserHikesOnUserDeleteAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());
        hikeService.Setup(s => s.DeleteHikeSharesByUserIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());
        var reviewService = new Mock<IReviewService>();
        reviewService.Setup(s => s.AnonymizeUserReviewsOnUserDeleteAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Fail(new Message(500, "review cleanup failed")));
        var trailObstacleRepo = new Mock<ITrailObstacleRepository>();

        // Act
        var result = await Build(repo, hikeService, trailObstacleRepo, reviewService: reviewService).DeleteUserAsync(Utilities.Identifiers.User, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task DeleteUser_WhenDeleteHikeSharesFails_ReturnsInternalServerError()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));
        var hikeService = new Mock<IHikeService>();
        hikeService.Setup(s => s.HandleUserHikesOnUserDeleteAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());
        hikeService.Setup(s => s.DeleteHikeSharesByUserIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Fail(new Message(500, "hike share cleanup failed")));
        var trailObstacleRepo = new Mock<ITrailObstacleRepository>();

        // Act
        var result = await Build(repo, hikeService, trailObstacleRepo).DeleteUserAsync(Utilities.Identifiers.User, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task DeleteUser_WhenAnonymizeObstaclesFails_ReturnsInternalServerError()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));
        var hikeService = new Mock<IHikeService>();
        hikeService.Setup(s => s.HandleUserHikesOnUserDeleteAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());
        hikeService.Setup(s => s.DeleteHikeSharesByUserIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());
        var trailObstacleRepo = new Mock<ITrailObstacleRepository>();
        trailObstacleRepo.Setup(r => r.AnonymizeObstaclesByUserIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Error());

        // Act
        var result = await Build(repo, hikeService, trailObstacleRepo).DeleteUserAsync(Utilities.Identifiers.User, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task DeleteUser_WhenDeleteFriendRequestsFails_ReturnsInternalServerError()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));
        var hikeService = new Mock<IHikeService>();
        hikeService.Setup(s => s.HandleUserHikesOnUserDeleteAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());
        hikeService.Setup(s => s.DeleteHikeSharesByUserIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());
        var trailObstacleRepo = new Mock<ITrailObstacleRepository>();
        trailObstacleRepo.Setup(r => r.AnonymizeObstaclesByUserIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());
        var friendRepo = new Mock<IFriendRepository>();
        friendRepo.Setup(r => r.DeleteAllFriendRequestsByUserIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Error());

        // Act
        var result = await Build(repo, hikeService, trailObstacleRepo, friendRepo).DeleteUserAsync(Utilities.Identifiers.User, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task DeleteUser_WhenFinalDeleteFails_ReturnsInternalServerError()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));
        repo.Setup(r => r.DeleteUserAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Error());
        var hikeService = new Mock<IHikeService>();
        hikeService.Setup(s => s.HandleUserHikesOnUserDeleteAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());
        hikeService.Setup(s => s.DeleteHikeSharesByUserIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());
        var trailObstacleRepo = new Mock<ITrailObstacleRepository>();
        trailObstacleRepo.Setup(r => r.AnonymizeObstaclesByUserIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());
        var friendRepo = new Mock<IFriendRepository>();
        friendRepo.Setup(r => r.DeleteAllFriendRequestsByUserIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        // Act
        var result = await Build(repo, hikeService, trailObstacleRepo, friendRepo).DeleteUserAsync(Utilities.Identifiers.User, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task DeleteUser_ErasesTheMailQueuedToThatAddress()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));
        repo.Setup(r => r.DeleteUserAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());
        var hikeService = new Mock<IHikeService>();
        hikeService.Setup(s => s.HandleUserHikesOnUserDeleteAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());
        hikeService.Setup(s => s.DeleteHikeSharesByUserIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());
        var trailObstacleRepo = new Mock<ITrailObstacleRepository>();
        trailObstacleRepo.Setup(r => r.AnonymizeObstaclesByUserIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());
        var friendRepo = new Mock<IFriendRepository>();
        friendRepo.Setup(r => r.DeleteAllFriendRequestsByUserIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());
        var mailOutboxRepo = new Mock<IMailOutboxRepository>();

        // Act
        var result = await Build(repo, hikeService, trailObstacleRepo, friendRepo, mailOutboxRepo: mailOutboxRepo)
            .DeleteUserAsync(Utilities.Identifiers.User, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        mailOutboxRepo.Verify(
            r => r.EraseByRecipientAsync("vandrare@example.com", It.IsAny<CancellationToken>()),
            Times.Once);
    }

    // The outbox has no foreign key to Users and is matched on the address, so the order is what
    // makes the erase possible at all: after the Users row goes there is no address to match on.
    [Fact]
    public async Task DeleteUser_ErasesTheMailBeforeTheUserRowGoes()
    {
        // Arrange
        var order = new List<string>();
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));
        repo.Setup(r => r.DeleteUserAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Callback(() => order.Add("delete user"))
            .ReturnsAsync(RepositoryResult.Success());
        var hikeService = new Mock<IHikeService>();
        hikeService.Setup(s => s.HandleUserHikesOnUserDeleteAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());
        hikeService.Setup(s => s.DeleteHikeSharesByUserIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());
        var trailObstacleRepo = new Mock<ITrailObstacleRepository>();
        trailObstacleRepo.Setup(r => r.AnonymizeObstaclesByUserIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());
        var friendRepo = new Mock<IFriendRepository>();
        friendRepo.Setup(r => r.DeleteAllFriendRequestsByUserIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());
        var mailOutboxRepo = new Mock<IMailOutboxRepository>();
        var service = Build(repo, hikeService, trailObstacleRepo, friendRepo, mailOutboxRepo: mailOutboxRepo);
        // After Build, which sets its own erase stub over anything passed in.
        mailOutboxRepo.Setup(r => r.EraseByRecipientAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Callback(() => order.Add("erase mail"))
            .ReturnsAsync(RepositoryResult<int>.Success(2));

        // Act
        var result = await service.DeleteUserAsync(Utilities.Identifiers.User, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        order.Should().Equal("erase mail", "delete user");
    }

    [Fact]
    public async Task DeleteUser_WhenErasingMailFails_ReturnsInternalServerError()
    {
        // Arrange
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));
        repo.Setup(r => r.DeleteUserAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());
        var hikeService = new Mock<IHikeService>();
        hikeService.Setup(s => s.HandleUserHikesOnUserDeleteAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());
        hikeService.Setup(s => s.DeleteHikeSharesByUserIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());
        var trailObstacleRepo = new Mock<ITrailObstacleRepository>();
        trailObstacleRepo.Setup(r => r.AnonymizeObstaclesByUserIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());
        var friendRepo = new Mock<IFriendRepository>();
        friendRepo.Setup(r => r.DeleteAllFriendRequestsByUserIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());
        var mailOutboxRepo = new Mock<IMailOutboxRepository>();
        var service = Build(repo, hikeService, trailObstacleRepo, friendRepo, mailOutboxRepo: mailOutboxRepo);
        // After Build, which sets its own erase stub over anything passed in.
        mailOutboxRepo.Setup(r => r.EraseByRecipientAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Error());

        // Act
        var result = await service.DeleteUserAsync(Utilities.Identifiers.User, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
        repo.Verify(r => r.DeleteUserAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
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
