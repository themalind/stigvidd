using Core.Interfaces.Repositories;
using Core.Services;
using FluentAssertions;
using Infrastructure.Data.Entities;
using Moq;
using System.Linq.Expressions;
using WebDataContracts.ResponseModels.HikeShare;

namespace UnitTests.ServiceTests;

public class HikeShareRecipientServiceTests
{
    public static HikeShareRecipientService Build(
        Mock<IHikeShareRecipientRepository>? hikeShareRecipientRepositoryMock = null,
        Mock<IUserRepository>? userRepositoryMock = null,
        Mock<IHikeRepository>? hikeRepositoryMock = null,
        Mock<IFriendRepository>? friendRepositoryMock = null)
    {
        return new HikeShareRecipientService(
            hikeShareRecipientRepositoryMock?.Object ?? new Mock<IHikeShareRecipientRepository>().Object,
            userRepositoryMock?.Object ?? new Mock<IUserRepository>().Object,
            hikeRepositoryMock?.Object ?? new Mock<IHikeRepository>().Object,
            friendRepositoryMock?.Object ?? new Mock<IFriendRepository>().Object
        );
    }

    private static Hike HikeOwnedByOther() => new()
    {
        Id = 10,
        Identifier = "hike-identifier",
        Name = "Test",
        CreatedBy = "owner-identifier",
        UserId = 99,
        Coordinates = "",
        HikeLength = 10,
        Duration = 3600
    };

    [Fact]
    public async Task GetAllHikesSharedWithUserAsync_WhenRepositoryError_ReturnsServerError()
    {
        // Arrange
        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.GetAllHikesSharedWithUserAsync(
                It.IsAny<string>(),
                It.IsAny<Expression<Func<HikeShare, HikeShareRecipientResponse>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<HikeShareRecipientResponse>>.Error());

        var service = Build(hikeShareRecipientRepositoryMock: repoMock);

        // Act
        var result = await service.GetAllHikesSharedWithUserAsync("user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task GetAllHikesSharedWithUserAsync_WhenSuccessful_ReturnsHikes()
    {
        // Arrange
        var hikes = new List<HikeShareRecipientResponse>
        {
            new() { HikeIdentifier = "id-1", HikeName = "Hike1", Coordinates = "[]" },
            new() { HikeIdentifier = "id-2", HikeName = "Hike2", Coordinates = "[]" }
        };

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.GetAllHikesSharedWithUserAsync(
                It.IsAny<string>(),
                It.IsAny<Expression<Func<HikeShare, HikeShareRecipientResponse>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<HikeShareRecipientResponse>>.Success(hikes));

        var service = Build(hikeShareRecipientRepositoryMock: repoMock);

        // Act
        var result = await service.GetAllHikesSharedWithUserAsync("user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().BeNull();
        result.Value.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetAllHikesSharedWithUserAsync_WhenSuccessful_ReturnsExtraFields()
    {
        // Arrange
        var hikes = new List<HikeShareRecipientResponse>
        {
            new()
            {
                HikeIdentifier = "id-1",
                HikeName = "Hike1",
                Coordinates = "[]",
                GettingThere = "Take bus 42",
                ParkingInfo = "Park near the church",
                Description = "Lovely forest hike"
            }
        };

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.GetAllHikesSharedWithUserAsync(
                It.IsAny<string>(),
                It.IsAny<Expression<Func<HikeShare, HikeShareRecipientResponse>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<HikeShareRecipientResponse>>.Success(hikes));

        var service = Build(hikeShareRecipientRepositoryMock: repoMock);

        // Act
        var result = await service.GetAllHikesSharedWithUserAsync("user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        var hike = result.Value.First();
        hike.GettingThere.Should().Be("Take bus 42");
        hike.ParkingInfo.Should().Be("Park near the church");
        hike.Description.Should().Be("Lovely forest hike");
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenCurrentUserNotFound_ReturnsNotFound()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", "reshareToName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("User not found with the given identifier.");
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenCurrentUserRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Error());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", "reshareToName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenHikeNotFound_ReturnsNotFound()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.NotFound());

        var service = Build(userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", "reshareToName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("Hike not found with the given identifier.");
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenHikeRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Error());

        var service = Build(userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", "reshareToName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenHasPermissionCheckFails_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(HikeOwnedByOther()));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.HasHikeSharedWithUserAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Error());

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", "reshareToName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenUserLacksPermission_ReturnsForbidden()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(HikeOwnedByOther()));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.HasHikeSharedWithUserAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(false));

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", "reshareToName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(403);
        result.Message.ResultMessage.Should().Be("You do not have permission to reshare this hike.");
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenReshareToUserNotFound_ReturnsNotFound()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));
        userRepoMock.Setup(r => r.GetUserByNickNameAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, int>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(HikeOwnedByOther()));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.HasHikeSharedWithUserAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", "reshareToName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("User not found with the given name.");
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenReshareToUserRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));
        userRepoMock.Setup(r => r.GetUserByNickNameAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, int>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Error());

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(HikeOwnedByOther()));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.HasHikeSharedWithUserAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", "reshareToName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenNotFriends_ReturnsForbidden()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));
        userRepoMock.Setup(r => r.GetUserByNickNameAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, int>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(2));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(HikeOwnedByOther()));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.HasHikeSharedWithUserAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        var friendRepoMock = new Mock<IFriendRepository>();
        friendRepoMock.Setup(r => r.FriendshipExistsAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(false));

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock, friendRepositoryMock: friendRepoMock);

        // Act
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", "reshareToName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(403);
        result.Message.ResultMessage.Should().Be("You can only share a hike with a friend.");
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenReshareToSelf_ReturnsBadRequest()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));
        userRepoMock.Setup(r => r.GetUserByNickNameAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, int>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(HikeOwnedByOther()));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.HasHikeSharedWithUserAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        var friendRepoMock = new Mock<IFriendRepository>();
        friendRepoMock.Setup(r => r.FriendshipExistsAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock, friendRepositoryMock: friendRepoMock);

        // Act
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", "reshareToName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(400);
        result.Message.ResultMessage.Should().Be("You cannot share a hike with yourself.");
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenReshareToOwner_ReturnsBadRequest()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));
        userRepoMock.Setup(r => r.GetUserByNickNameAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, int>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(99)); // matches hike.UserId

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(HikeOwnedByOther()));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.HasHikeSharedWithUserAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        var friendRepoMock = new Mock<IFriendRepository>();
        friendRepoMock.Setup(r => r.FriendshipExistsAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock, friendRepositoryMock: friendRepoMock);

        // Act
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", "reshareToName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(400);
        result.Message.ResultMessage.Should().Be("You cannot reshare a hike to the owner.");
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenAlreadySharedCheckFails_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));
        userRepoMock.Setup(r => r.GetUserByNickNameAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, int>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(2));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(HikeOwnedByOther()));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.HasHikeSharedWithUserAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));
        repoMock.Setup(r => r.HasHikeSharedWithUserAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Error());

        var friendRepoMock = new Mock<IFriendRepository>();
        friendRepoMock.Setup(r => r.FriendshipExistsAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock, friendRepositoryMock: friendRepoMock);

        // Act
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", "reshareToName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenAlreadySharedWithTarget_ReturnsConflict()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));
        userRepoMock.Setup(r => r.GetUserByNickNameAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, int>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(2));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(HikeOwnedByOther()));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.HasHikeSharedWithUserAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));
        repoMock.Setup(r => r.HasHikeSharedWithUserAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        var friendRepoMock = new Mock<IFriendRepository>();
        friendRepoMock.Setup(r => r.FriendshipExistsAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock, friendRepositoryMock: friendRepoMock);

        // Act
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", "reshareToName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(409);
        result.Message.ResultMessage.Should().Be("This hike has already been shared with this user.");
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenTargetAlreadyHasPendingShare_ReturnsConflict()
    {
        // Arrange — recipient has a pending (not yet accepted) share for this hike;
        // the check must catch it so we don't silently create a duplicate request
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));
        userRepoMock.Setup(r => r.GetUserByNickNameAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, int>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(2));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(HikeOwnedByOther()));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.HasHikeSharedWithUserAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));
        repoMock.Setup(r => r.HasHikeSharedWithUserAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true)); // pending share exists

        var friendRepoMock = new Mock<IFriendRepository>();
        friendRepoMock.Setup(r => r.FriendshipExistsAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock, friendRepositoryMock: friendRepoMock);

        // Act
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", "reshareToName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(409);
        result.Message.ResultMessage.Should().Be("This hike has already been shared with this user.");
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenReshareRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));
        userRepoMock.Setup(r => r.GetUserByNickNameAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, int>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(2));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(HikeOwnedByOther()));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        // SetupSequence: first call (permission check) → true, second call (duplicate check) → false
        repoMock.SetupSequence(r => r.HasHikeSharedWithUserAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true))
            .ReturnsAsync(RepositoryResult<bool>.Success(false));
        repoMock.Setup(r => r.ReshareSharedHikeAsync(It.IsAny<HikeShare>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Error());

        var friendRepoMock = new Mock<IFriendRepository>();
        friendRepoMock.Setup(r => r.FriendshipExistsAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock, friendRepositoryMock: friendRepoMock);

        // Act
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", "reshareToName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenSuccessful_ReturnsOk()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));
        userRepoMock.Setup(r => r.GetUserByNickNameAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, int>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(2));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(HikeOwnedByOther()));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        // SetupSequence: first call (permission check) → true, second call (duplicate check) → false
        repoMock.SetupSequence(r => r.HasHikeSharedWithUserAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true))
            .ReturnsAsync(RepositoryResult<bool>.Success(false));
        repoMock.Setup(r => r.ReshareSharedHikeAsync(It.IsAny<HikeShare>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        var friendRepoMock = new Mock<IFriendRepository>();
        friendRepoMock.Setup(r => r.FriendshipExistsAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock, friendRepositoryMock: friendRepoMock);

        // Act
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", "reshareToName", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().BeNull();
    }

    [Fact]
    public async Task RemoveSharedHikeAsync_WhenUserNotFound_ReturnsNotFound()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.RemoveSharedHikeAsync("hike-identifier", "user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("User not found with the given identifier.");
    }

    [Fact]
    public async Task RemoveSharedHikeAsync_WhenUserRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Error());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.RemoveSharedHikeAsync("hike-identifier", "user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task RemoveSharedHikeAsync_WhenHikeNotFound_ReturnsNotFound()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

        var service = Build(userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.RemoveSharedHikeAsync("hike-identifier", "user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("Hike not found with the given identifier.");
    }

    [Fact]
    public async Task RemoveSharedHikeAsync_WhenHikeRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Error());

        var service = Build(userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.RemoveSharedHikeAsync("hike-identifier", "user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task RemoveSharedHikeAsync_WhenDeleteRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(10));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.DeleteHikeShareAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Error());

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.RemoveSharedHikeAsync("hike-identifier", "user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task RemoveSharedHikeAsync_WhenSuccessful_ReturnsOk()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(10));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.DeleteHikeShareAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.RemoveSharedHikeAsync("hike-identifier", "user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().BeNull();
    }

    // GetIncomingPendingSharesAsync

    [Fact]
    public async Task GetIncomingPendingSharesAsync_WhenUserNotFound_ReturnsNotFound()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.GetIncomingPendingSharesAsync("user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("User not found with the given identifier.");
    }

    [Fact]
    public async Task GetIncomingPendingSharesAsync_WhenUserRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Error());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.GetIncomingPendingSharesAsync("user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task GetIncomingPendingSharesAsync_WhenRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.GetPendingSharesForUserAsync(
                It.IsAny<int>(),
                It.IsAny<Expression<Func<HikeShare, IncomingHikeShareResponse>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<IncomingHikeShareResponse>>.Error());

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock);

        // Act
        var result = await service.GetIncomingPendingSharesAsync("user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task GetIncomingPendingSharesAsync_WhenSuccessful_ReturnsPendingShares()
    {
        // Arrange
        var shares = new List<IncomingHikeShareResponse>
        {
            IncomingHikeShareResponse.Create("hike-1", "TestHike1", 10, 3600, "Sender", "sender-id", "Creator", DateTime.UtcNow),
            IncomingHikeShareResponse.Create("hike-2", "TestHike2", 20, 7200, "Sender", "sender-id", "Creator", DateTime.UtcNow)
        };

        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.GetPendingSharesForUserAsync(
                It.IsAny<int>(),
                It.IsAny<Expression<Func<HikeShare, IncomingHikeShareResponse>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<IncomingHikeShareResponse>>.Success(shares));

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock);

        // Act
        var result = await service.GetIncomingPendingSharesAsync("user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().BeNull();
        result.Value.Should().HaveCount(2);
    }

    // GetIncomingPendingShareAsync

    [Fact]
    public async Task GetIncomingPendingShareAsync_WhenUserNotFound_ReturnsNotFound()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.GetIncomingPendingShareAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("User not found with the given identifier.");
    }

    [Fact]
    public async Task GetIncomingPendingShareAsync_WhenUserRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Error());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.GetIncomingPendingShareAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task GetIncomingPendingShareAsync_WhenShareNotFound_ReturnsNotFound()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.GetPendingShareByIdentifierAsync(
                It.IsAny<int>(), It.IsAny<string>(),
                It.IsAny<Expression<Func<HikeShare, HikeShareRecipientResponse>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<HikeShareRecipientResponse>.NotFound());

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock);

        // Act
        var result = await service.GetIncomingPendingShareAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("Pending share not found.");
    }

    [Fact]
    public async Task GetIncomingPendingShareAsync_WhenRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.GetPendingShareByIdentifierAsync(
                It.IsAny<int>(), It.IsAny<string>(),
                It.IsAny<Expression<Func<HikeShare, HikeShareRecipientResponse>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<HikeShareRecipientResponse>.Error());

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock);

        // Act
        var result = await service.GetIncomingPendingShareAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task GetIncomingPendingShareAsync_WhenSuccessful_ReturnsShare()
    {
        // Arrange
        var share = HikeShareRecipientResponse.Create(
            "hike-1", "TestHike1", 10, 3600, "[]", "Creator", "Sender", "sender-id",
            DateTime.UtcNow, null, null, "A lovely hike");

        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.GetPendingShareByIdentifierAsync(
                It.IsAny<int>(), It.IsAny<string>(),
                It.IsAny<Expression<Func<HikeShare, HikeShareRecipientResponse>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<HikeShareRecipientResponse>.Success(share));

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock);

        // Act
        var result = await service.GetIncomingPendingShareAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().BeNull();
        result.Value!.HikeIdentifier.Should().Be("hike-1");
        result.Value.Description.Should().Be("A lovely hike");
    }

    // AcceptHikeShareAsync

    [Fact]
    public async Task AcceptHikeShareAsync_WhenUserNotFound_ReturnsNotFound()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.AcceptHikeShareAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("User not found with the given identifier.");
    }

    [Fact]
    public async Task AcceptHikeShareAsync_WhenUserRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Error());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.AcceptHikeShareAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task AcceptHikeShareAsync_WhenHikeNotFound_ReturnsNotFound()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

        var service = Build(userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.AcceptHikeShareAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("Hike not found with the given identifier.");
    }

    [Fact]
    public async Task AcceptHikeShareAsync_WhenHikeRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Error());

        var service = Build(userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.AcceptHikeShareAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task AcceptHikeShareAsync_WhenRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(10));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.AcceptHikeShareAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Error());

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.AcceptHikeShareAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task AcceptHikeShareAsync_WhenShareNotFound_ReturnsNotFound()
    {
        // Arrange — repo returns NotFound when no pending row matches (hikeId, userId)
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(10));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.AcceptHikeShareAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.NotFound());

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.AcceptHikeShareAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("Pending share not found.");
    }

    [Fact]
    public async Task AcceptHikeShareAsync_WhenSuccessful_ReturnsOk()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(10));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.AcceptHikeShareAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.AcceptHikeShareAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().BeNull();
    }

    // RejectHikeShareAsync

    [Fact]
    public async Task RejectHikeShareAsync_WhenUserNotFound_ReturnsNotFound()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.RejectHikeShareAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("User not found with the given identifier.");
    }

    [Fact]
    public async Task RejectHikeShareAsync_WhenUserRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Error());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.RejectHikeShareAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task RejectHikeShareAsync_WhenHikeNotFound_ReturnsNotFound()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

        var service = Build(userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.RejectHikeShareAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("Hike not found with the given identifier.");
    }

    [Fact]
    public async Task RejectHikeShareAsync_WhenHikeRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Error());

        var service = Build(userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.RejectHikeShareAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task RejectHikeShareAsync_WhenHikeShareNotFound_ReturnsNotFound()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(10));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.RejectHikeShareAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.NotFound());

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.RejectHikeShareAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("Hike share not found.");
    }

    [Fact]
    public async Task RejectHikeShareAsync_WhenRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(10));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.RejectHikeShareAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Error());

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.RejectHikeShareAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task RejectHikeShareAsync_WhenSuccessful_ReturnsOk()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(10));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.RejectHikeShareAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.RejectHikeShareAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().BeNull();
    }
}
