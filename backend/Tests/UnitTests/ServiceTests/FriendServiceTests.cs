using Core.Interfaces.Repositories;
using Core.Services;
using FluentAssertions;
using Infrastructure.Data.Entities;
using Moq;
using System.Linq.Expressions;
using WebDataContracts.ResponseModels.Friend;

namespace UnitTests.ServiceTests;

public class FriendServiceTests
{
    public static FriendService Build(
        Mock<IFriendRepository>? friendRepositoryMock = null,
        Mock<IUserRepository>? userRepositoryMock = null)
    {
        return new FriendService(
            friendRepositoryMock?.Object ?? new Mock<IFriendRepository>().Object,
            userRepositoryMock?.Object ?? new Mock<IUserRepository>().Object
        );
    }

    [Fact]
    public async Task AcceptFriendRequestAsync_WhenCurrentUserNotFound_ReturnsNotFound()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

        var friendsRepoMock = new Mock<IFriendRepository>();
        friendsRepoMock.Setup(r => r.AcceptRequestAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
           .ReturnsAsync(RepositoryResult.Success());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.AcceptFriendRequestAsync("current-user-identifier", "requester-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("Current user not found.");
    }

    [Fact]
    public async Task AcceptFriendRequestAsync_WhenRequesterNotFound_ReturnsNotFound()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.SetupSequence(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

        var friendsRepoMock = new Mock<IFriendRepository>();
        friendsRepoMock.Setup(r => r.AcceptRequestAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
           .ReturnsAsync(RepositoryResult.Success());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.AcceptFriendRequestAsync("current-user-identifier", "requester-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("Requester user not found.");
    }

    [Fact]
    public async Task AcceptFriendRequestAsync_WhenFriendRequestNotFound_ReturnsNotFound()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.SetupSequence(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1))
            .ReturnsAsync(RepositoryResult<int>.Success(2));

        var friendsRepoMock = new Mock<IFriendRepository>();
        friendsRepoMock.Setup(r => r.AcceptRequestAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
           .ReturnsAsync(RepositoryResult.NotFound());

        var service = Build(userRepositoryMock: userRepoMock, friendRepositoryMock: friendsRepoMock);

        // Act
        var result = await service.AcceptFriendRequestAsync("current-user-identifier", "requester-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("Friend request not found.");
    }

    [Fact]
    public async Task AcceptFriendRequestAsync_WhenSuccessful_ReturnsOk()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.SetupSequence(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1))
            .ReturnsAsync(RepositoryResult<int>.Success(2));

        var friendsRepoMock = new Mock<IFriendRepository>();
        friendsRepoMock.Setup(r => r.AcceptRequestAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
           .ReturnsAsync(RepositoryResult.Success());

        var service = Build(userRepositoryMock: userRepoMock, friendRepositoryMock: friendsRepoMock);

        // Act
        var result = await service.AcceptFriendRequestAsync("current-user-identifier", "requester-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().BeNull();
    }

    [Fact]
    public async Task GetFriendsAsync_WhenUserNotFound_ReturnsNotFound()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.GetFriendsAsync("current-user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("User not found.");
    }

    [Fact]
    public async Task GetFriendsAsync_WhenSuccessful_ReturnsFriends()
    {
        // Arrange
        var friends = new List<FriendResponse>
        {
               new FriendResponse { Identifier = "Hobbit-identifier-1", NickName = "Frodo" },
               new FriendResponse { Identifier = "Hobbit-identifier-2", NickName = "Sam" }
        };

        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var friendsRepoMock = new Mock<IFriendRepository>();
        friendsRepoMock.Setup(r => r.GetFriendsAsync(It.IsAny<int>(), It.IsAny<Expression<Func<User, FriendResponse>>>(), It.IsAny<CancellationToken>()))
           .ReturnsAsync(RepositoryResult<IEnumerable<FriendResponse>>.Success(friends));

        var service = Build(userRepositoryMock: userRepoMock, friendRepositoryMock: friendsRepoMock);

        // Act
        var result = await service.GetFriendsAsync("current-user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().BeNull();
        result.Value.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetFriendsAsync_WhenRepositoryError_ReturnsError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var friendsRepoMock = new Mock<IFriendRepository>();
        friendsRepoMock.Setup(r => r.GetFriendsAsync(It.IsAny<int>(), It.IsAny<Expression<Func<User, FriendResponse>>>(), It.IsAny<CancellationToken>()))
           .ReturnsAsync(RepositoryResult<IEnumerable<FriendResponse>>.Error());

        var service = Build(userRepositoryMock: userRepoMock, friendRepositoryMock: friendsRepoMock);

        // Act
        var result = await service.GetFriendsAsync("current-user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
        result.Message.ResultMessage.Should().Be("An error occurred while fetching friends.");
    }

    [Fact]
    public async Task GetIncomingRequestsAsync_WhenRepositoryError_ReturnsError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var requestsRepoMock = new Mock<IFriendRepository>();
        requestsRepoMock.Setup(r => r.GetIncomingRequestsAsync(It.IsAny<int>(), It.IsAny<Expression<Func<FriendRequest, FriendRequestResponse>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IEnumerable<FriendRequestResponse>>.Error());

        var service = Build(userRepositoryMock: userRepoMock, friendRepositoryMock: requestsRepoMock);

        // Act
        var result = await service.GetIncomingRequestsAsync("current-user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
        result.Message.ResultMessage.Should().Be("An error occurred while fetching incoming friend requests.");
    }

    [Fact]
    public async Task GetIncomingRequestsAsync_WhenSuccessful_ReturnsRequests()
    {
        // Arrange
        var requests = new List<FriendRequestResponse>
        {
               new FriendRequestResponse { RequesterIdentifier = "Hobbit-identifier-1", RequesterNickName = "Merry" },
               new FriendRequestResponse { RequesterIdentifier = "Hobbit-identifier-2", RequesterNickName = "Pippin" }
        };

        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var requestsRepoMock = new Mock<IFriendRepository>();
        requestsRepoMock.Setup(r => r.GetIncomingRequestsAsync(It.IsAny<int>(), It.IsAny<Expression<Func<FriendRequest, FriendRequestResponse>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IEnumerable<FriendRequestResponse>>.Success(requests));

        var service = Build(userRepositoryMock: userRepoMock, friendRepositoryMock: requestsRepoMock);

        // Act
        var result = await service.GetIncomingRequestsAsync("current-user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().BeNull();
        result.Value.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetIncomingRequestsAsync_WhenUserNotFound_ReturnsNotFound()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.GetIncomingRequestsAsync("current-user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("User not found.");
    }

    [Fact]
    public async Task GetOutgoingRequestsAsync_WhenUserNotFound_ReturnsNotFound()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act

        var result = await service.GetOutgoingRequestsAsync("current-user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("User not found.");
    }

    [Fact]
    public async Task GetOutgoingRequestsAsync_WhenRepositoryError_ReturnsError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var requestsRepoMock = new Mock<IFriendRepository>();
        requestsRepoMock.Setup(r => r.GetOutgoingRequestsAsync(It.IsAny<int>(), It.IsAny<Expression<Func<FriendRequest, OutgoingFriendRequestResponse>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IEnumerable<OutgoingFriendRequestResponse>>.Error());

        var service = Build(userRepositoryMock: userRepoMock, friendRepositoryMock: requestsRepoMock);

        // Act
        var result = await service.GetOutgoingRequestsAsync("current-user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
        result.Message.ResultMessage.Should().Be("An error occurred while fetching outgoing friend requests.");
    }

    [Fact]
    public async Task GetOutgoingRequestsAsync_WhenSuccessful_ReturnsRequests()
    {
        // Arrange
        var requests = new List<OutgoingFriendRequestResponse>
        {
               new OutgoingFriendRequestResponse { ReceiverIdentifier = "Fellowship-identifier-1", ReceiverNickName = "Legolas" },
               new OutgoingFriendRequestResponse { ReceiverIdentifier = "Fellowship-identifier-2", ReceiverNickName = "Gimli" }
        };

        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var requestsRepoMock = new Mock<IFriendRepository>();
        requestsRepoMock.Setup(r => r.GetOutgoingRequestsAsync(It.IsAny<int>(), It.IsAny<Expression<Func<FriendRequest, OutgoingFriendRequestResponse>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IEnumerable<OutgoingFriendRequestResponse>>.Success(requests));

        var service = Build(userRepositoryMock: userRepoMock, friendRepositoryMock: requestsRepoMock);

        // Act
        var result = await service.GetOutgoingRequestsAsync("current-user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().BeNull();
        result.Value.Should().HaveCount(2);
    }

    [Fact]
    public async Task RemoveConnectionAsync_ShouldReturnNotFound_WhenUserNotFound()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.RemoveConnectionAsync("current-user-identifier", "friend-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task RemoveConnectionAsync_ShouldReturnServerError_WhenRepositoryError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.SetupSequence(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1))
            .ReturnsAsync(RepositoryResult<int>.Success(2));

        var friendRepoMock = new Mock<IFriendRepository>();
        friendRepoMock.Setup(r => r.RemoveFriendShipOrFriendRequestAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Error());

        var service = Build(userRepositoryMock: userRepoMock, friendRepositoryMock: friendRepoMock);

        // Act
        var result = await service.RemoveConnectionAsync("current-user-identifier", "friend-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task RemoveConnectionAsync_ShouldReturnNotFound_WhenFriendNotFound()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.SetupSequence(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.RemoveConnectionAsync("current-user-identifier", "friend-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task RemoveConnectionAsync_ShouldReturnOk_WhenSuccessful()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.SetupSequence(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1))
            .ReturnsAsync(RepositoryResult<int>.Success(2));

        var friendRepoMock = new Mock<IFriendRepository>();
        friendRepoMock.Setup(r => r.RemoveFriendShipOrFriendRequestAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        var service = Build(userRepositoryMock: userRepoMock, friendRepositoryMock: friendRepoMock);

        // Act
        var result = await service.RemoveConnectionAsync("current-user-identifier", "friend-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().BeNull();
    }

    [Fact]
    public async Task RemoveConnectionAsync_ShouldReturnNotFound_WhenNoExistingConnection()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.SetupSequence(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1))
            .ReturnsAsync(RepositoryResult<int>.Success(2));

        var friendRepoMock = new Mock<IFriendRepository>();
        friendRepoMock.Setup(r => r.RemoveFriendShipOrFriendRequestAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.NotFound());

        var service = Build(userRepositoryMock: userRepoMock, friendRepositoryMock: friendRepoMock);

        // Act
        var result = await service.RemoveConnectionAsync("current-user-identifier", "friend-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task RemoveConnectionAsync_ShouldReturnServerError_WhenCurrentUserRepositoryErrors()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Error());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.RemoveConnectionAsync("current-user-identifier", "friend-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task RemoveConnectionAsync_ShouldReturnServerError_WhenOtherUserRepositoryErrors()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.SetupSequence(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1))
            .ReturnsAsync(RepositoryResult<int>.Error());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.RemoveConnectionAsync("current-user-identifier", "friend-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task SendFriendRequestAsync_ShouldReturnNotFound_WhenCurrentUserNotFound()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.SendFriendRequestAsync("current-user-identifier", "receiver-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task SendFriendRequestAsync_ShouldReturnNotFound_WhenReceiverNotFound()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));
        userRepoMock.Setup(r => r.GetUserIdByNameAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
           .ReturnsAsync(RepositoryResult<int>.NotFound());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.SendFriendRequestAsync("current-user-identifier", "receiver-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("Receiver not found.");
    }

    [Fact]
    public async Task SendFriendRequestAsync_ShouldReturnServerError_WhenRepositoryError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));
        userRepoMock.Setup(r => r.GetUserIdByNameAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(2));

        var friendRepoMock = new Mock<IFriendRepository>();
        friendRepoMock.Setup(r => r.SendRequestAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Error());
        friendRepoMock.Setup(r => r.FriendshipExistsAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(false));

        var service = Build(userRepositoryMock: userRepoMock, friendRepositoryMock: friendRepoMock);

        // Act
        var result = await service.SendFriendRequestAsync("current-user-identifier", "receiver-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task SendFriendRequestAsync_ShouldReturnBadRequest_WhenUserSendsRequestToSelf()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));
        userRepoMock.Setup(r => r.GetUserIdByNameAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.SendFriendRequestAsync("current-user-identifier", "current-user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(400);
        result.Message.ResultMessage.Should().Be("You cannot send a friend request to yourself.");
    }

    [Fact]
    public async Task SendFriendRequestAsync_ShouldReturnConflict_WhenFriendshipAlreadyExists()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));
        userRepoMock.Setup(r => r.GetUserIdByNameAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(2));

        var friendRepoMock = new Mock<IFriendRepository>();
        friendRepoMock.Setup(r => r.FriendshipExistsAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        var service = Build(userRepositoryMock: userRepoMock, friendRepositoryMock: friendRepoMock);

        // Act
        var result = await service.SendFriendRequestAsync("current-user-identifier", "receiver-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(409);
        result.Message.ResultMessage.Should().Be("A friend request or friendship already exists.");
    }

    [Fact]
    public async Task SendFriendRequestAsync_ShouldReturnOk_WhenSuccessful()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));
        userRepoMock.Setup(r => r.GetUserIdByNameAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(2));

        var friendRepoMock = new Mock<IFriendRepository>();
        friendRepoMock.Setup(r => r.FriendshipExistsAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(false));
        friendRepoMock.Setup(r => r.SendRequestAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        var service = Build(userRepositoryMock: userRepoMock, friendRepositoryMock: friendRepoMock);

        // Act
        var result = await service.SendFriendRequestAsync("current-user-identifier", "receiver-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().BeNull();
    }

    [Fact]
    public async Task SendFriendRequestAsync_ShouldReturnServerError_WhenCurrentUserRepositoryErrors()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Error());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.SendFriendRequestAsync("current-user-identifier", "receiver-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task SendFriendRequestAsync_ShouldReturnServerError_WhenReceiverRepositoryErrors()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));
        userRepoMock.Setup(r => r.GetUserIdByNameAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Error());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.SendFriendRequestAsync("current-user-identifier", "receiver-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task SendFriendRequestAsync_ShouldReturnServerError_WhenFriendshipExistsCheckFails()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));
        userRepoMock.Setup(r => r.GetUserIdByNameAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(2));

        var friendRepoMock = new Mock<IFriendRepository>();
        friendRepoMock.Setup(r => r.FriendshipExistsAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Error());

        var service = Build(userRepositoryMock: userRepoMock, friendRepositoryMock: friendRepoMock);

        // Act
        var result = await service.SendFriendRequestAsync("current-user-identifier", "receiver-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
        result.Message.ResultMessage.Should().Be("An error occurred while checking friendship status.");
    }

    [Fact]
    public async Task AcceptFriendRequestAsync_WhenCurrentUserRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Error());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.AcceptFriendRequestAsync("current-user-identifier", "requester-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
        result.Message.ResultMessage.Should().Be("An error occurred while retrieving the current user.");
    }

    [Fact]
    public async Task AcceptFriendRequestAsync_WhenRequesterRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.SetupSequence(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1))
            .ReturnsAsync(RepositoryResult<int>.Error());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.AcceptFriendRequestAsync("Sauron", "Saruman", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
        result.Message.ResultMessage.Should().Be("An error occurred while retrieving the requester user.");
    }

    [Fact]
    public async Task AcceptFriendRequestAsync_WhenAcceptRequestRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.SetupSequence(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1))
            .ReturnsAsync(RepositoryResult<int>.Success(2));

        var friendsRepoMock = new Mock<IFriendRepository>();
        friendsRepoMock.Setup(r => r.AcceptRequestAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
           .ReturnsAsync(RepositoryResult.Error());

        var service = Build(userRepositoryMock: userRepoMock, friendRepositoryMock: friendsRepoMock);

        // Act
        var result = await service.AcceptFriendRequestAsync("current-user-identifier", "requester-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
        result.Message.ResultMessage.Should().Be("An error occurred while accepting the friend request.");
    }

    [Fact]
    public async Task GetFriendsAsync_WhenUserRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Error());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.GetFriendsAsync("current-user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task GetIncomingRequestsAsync_WhenUserRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Error());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.GetIncomingRequestsAsync("current-user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task GetOutgoingRequestsAsync_WhenUserRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Error());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.GetOutgoingRequestsAsync("current-user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }
}
