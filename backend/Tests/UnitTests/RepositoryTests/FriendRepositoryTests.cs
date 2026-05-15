using Core.Repositories;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using WebDataContracts.ResponseModels.Friend;

namespace UnitTests.RepositoryTests;

public class FriendRepositoryTests : TestBase
{
    private const int UserIdWithFriend = 1;
    private const int FriendUserId = 2;
    private const int RequesterUserId = 3;
    private const int UserIdWithNoFriends = 5;
    private const int UserWithNoIncomingRequestsUserId = 4;

    [Fact]
    public async Task GetFriendsAsync_WhenFound_ReturnsSuccess()
    {
        // Arrange
        var repo = new FriendRepository(CreateSeededFactory(), NullLogger<FriendRepository>.Instance);

        // Act
        var result = await repo.GetFriendsAsync(UserIdWithFriend, u => FriendResponse.Create(u.Identifier, u.NickName), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetFriendsAync_WhenNotFound_ReturnsSuccess()
    {
        // Arrange
        var repo = new FriendRepository(CreateSeededFactory(), NullLogger<FriendRepository>.Instance);

        // Act
        var result = await repo.GetFriendsAsync(UserIdWithNoFriends, u => FriendResponse.Create(u.Identifier, u.NickName), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(0);
    }

    [Fact]
    public async Task FriendshipExistsAsync_WhenExists_ReturnsTrue()
    {
        // Arrange
        var repo = new FriendRepository(CreateSeededFactory(), NullLogger<FriendRepository>.Instance);

        // Act
        var result = await repo.FriendshipExistsAsync(UserIdWithFriend, FriendUserId, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeTrue();
    }

    [Fact]
    public async Task FriendshipExistsAsync_WhenNotExists_ReturnsFalse()
    {
        // Arrange
        var repo = new FriendRepository(CreateSeededFactory(), NullLogger<FriendRepository>.Instance);

        // Act
        var result = await repo.FriendshipExistsAsync(UserIdWithNoFriends, FriendUserId, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeFalse();
    }

    [Fact]
    public async Task FriendshipExistsAsync_WhenRequestPending_ReturnsFalse()
    {
        // Arrange
        var repo = new FriendRepository(CreateSeededFactory(), NullLogger<FriendRepository>.Instance);

        // Act
        var result = await repo.FriendshipExistsAsync(UserIdWithFriend, RequesterUserId, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeFalse();
    }

    [Fact]
    public async Task FriendshipExistsAsync_WhenRequestRejected_ReturnsFalse()
    {
        // Arrange
        var repo = new FriendRepository(CreateSeededFactory(), NullLogger<FriendRepository>.Instance);

        // Act
        var result = await repo.FriendshipExistsAsync(UserIdWithFriend, 4, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeFalse();
    }

    [Fact]
    public async Task GetIncomingRequestsAsync_WhenFound_ReturnsSuccess()
    {
        // Arrange
        var repo = new FriendRepository(CreateSeededFactory(), NullLogger<FriendRepository>.Instance);

        // Act
        var result = await repo.GetIncomingRequestsAsync(RequesterUserId, u => FriendResponse.Create(u.Requester!.Identifier, u.Requester.NickName), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetIncomingRequestsAsync_WhenNotFound_ReturnsSuccess()
    {
        // Arrange
        var repo = new FriendRepository(CreateSeededFactory(), NullLogger<FriendRepository>.Instance);

        // Act
        var result = await repo.GetIncomingRequestsAsync(
            UserWithNoIncomingRequestsUserId,
            u => FriendResponse.Create(u.Receiver!.Identifier, u.Receiver.NickName), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(0);
    }

    [Fact]
    public async Task GetOutgoingRequestsAsync_WhenFound_ReturnsSuccess()
    {
        // Arrange
        var repo = new FriendRepository(CreateSeededFactory(), NullLogger<FriendRepository>.Instance);

        // Act
        var result = await repo.GetOutgoingRequestsAsync(UserIdWithFriend, u => FriendResponse.Create(u.Receiver!.Identifier, u.Receiver.NickName), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetOutgoingRequestsAsync_WhenNotFound_ReturnsSuccess()
    {
        // Arrange
        var repo = new FriendRepository(CreateSeededFactory(), NullLogger<FriendRepository>.Instance);

        // Act
        var result = await repo.GetOutgoingRequestsAsync(UserIdWithNoFriends, u => FriendResponse.Create(u.Receiver!.Identifier, u.Receiver.NickName), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(0);
    }

    [Fact]
    public async Task RemoveFriendShipOrFriendRequestAsync_WhenFound_ReturnsSuccess()
    {
        // Arrange
        var repo = new FriendRepository(CreateSeededFactory(), NullLogger<FriendRepository>.Instance);

        // Act
        var result = await repo.RemoveFriendShipOrFriendRequestAsync(UserIdWithFriend, FriendUserId, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();

        // Verify that the friendship/request is removed
        var verify = await repo.FriendshipExistsAsync(UserIdWithFriend, FriendUserId, CancellationToken.None);
        verify.IsSuccess.Should().BeTrue();
        verify.Value.Should().BeFalse();
    }

    [Fact]
    public async Task RemoveFriendShipOrFriendRequestAsync_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new FriendRepository(CreateSeededFactory(), NullLogger<FriendRepository>.Instance);

        // Act
        var result = await repo.RemoveFriendShipOrFriendRequestAsync(UserIdWithNoFriends, FriendUserId, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task AcceptRequestAsync_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new FriendRepository(CreateSeededFactory(), NullLogger<FriendRepository>.Instance);

        // Act
        var result = await repo.AcceptRequestAsync(RequesterUserId, UserWithNoIncomingRequestsUserId, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task AcceptRequestAsync_WhenFound_ReturnsSuccess()
    {
        // Arrange
        var repo = new FriendRepository(CreateSeededFactory(), NullLogger<FriendRepository>.Instance);

        // Act
        var result = await repo.AcceptRequestAsync(UserIdWithFriend, RequesterUserId, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();

        // Verify that the friendship is now accepted
        var verify = await repo.FriendshipExistsAsync(UserIdWithFriend, RequesterUserId, CancellationToken.None);
        verify.IsSuccess.Should().BeTrue();
        verify.Value.Should().BeTrue();
    }

    [Fact]
    public async Task RejectRequestAsync_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new FriendRepository(CreateSeededFactory(), NullLogger<FriendRepository>.Instance);

        // Act
        var result = await repo.RejectRequestAsync(RequesterUserId, UserWithNoIncomingRequestsUserId, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task RejectRequestAsync_WhenFound_ReturnsSuccess()
    {
        // Arrange
        var repo = new FriendRepository(CreateSeededFactory(), NullLogger<FriendRepository>.Instance);

        // Act
        var result = await repo.RejectRequestAsync(UserIdWithFriend, RequesterUserId, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();

        // Verify that the friendship is now rejected (not accepted)
        var verify = await repo.FriendshipExistsAsync(UserIdWithFriend, RequesterUserId, CancellationToken.None);
        verify.IsSuccess.Should().BeTrue();
        verify.Value.Should().BeFalse();
    }

    [Fact]
    public async Task DeleteAllFriendRequestsByUserIdAsync_WhenFound_ReturnsSuccess()
    {
        // Arrange
        var repo = new FriendRepository(CreateSeededFactory(), NullLogger<FriendRepository>.Instance);

        // Act
        var result = await repo.DeleteAllFriendRequestsByUserIdAsync(UserIdWithFriend, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteAllFriendRequestsByUserIdAsync_WhenNotFound_ReturnsSuccess()
    {
        // Arrange
        var repo = new FriendRepository(CreateSeededFactory(), NullLogger<FriendRepository>.Instance);

        // Act
        var result = await repo.DeleteAllFriendRequestsByUserIdAsync(UserIdWithNoFriends, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task SendRequestAsync_WhenFound_ReturnsSuccess()
    {
        // Arrange
        var repo = new FriendRepository(CreateSeededFactory(), NullLogger<FriendRepository>.Instance);

        // Act
        var result = await repo.SendRequestAsync(UserIdWithNoFriends, FriendUserId, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task SendRequestAsync_WhenAlreadyExists_ReturnsConflict()
    {
        // Arrange
        var repo = new FriendRepository(CreateSeededFactory(), NullLogger<FriendRepository>.Instance);

        // Act
        var result = await repo.SendRequestAsync(UserIdWithFriend, FriendUserId, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.Conflict);
    }

    [Fact]
    public async Task FriendshipExistsAsync_WhenExistsFromReceiverPerspective_ReturnsTrue()
    {
        // Arrange — seed has 1→2 Accepted; check from the receiver's side to exercise the reversed OR branch
        var repo = new FriendRepository(CreateSeededFactory(), NullLogger<FriendRepository>.Instance);

        // Act
        var result = await repo.FriendshipExistsAsync(FriendUserId, UserIdWithFriend, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeTrue();
    }

    [Fact]
    public async Task GetFriendsAsync_WhenUserIsReceiver_ReturnsCorrectFriend()
    {
        // Arrange — seed has 1→2 Accepted; user 2 is the receiver so this exercises the reversed OR branch
        var repo = new FriendRepository(CreateSeededFactory(), NullLogger<FriendRepository>.Instance);

        // Act
        var result = await repo.GetFriendsAsync(FriendUserId, u => FriendResponse.Create(u.Identifier, u.NickName), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(1);
    }

    [Fact]
    public async Task RemoveFriendShipOrFriendRequestAsync_WhenPendingRequest_ReturnsSuccess()
    {
        // Arrange — seed has 1→3 Pending; remove a pending request, not an accepted friendship
        var repo = new FriendRepository(CreateSeededFactory(), NullLogger<FriendRepository>.Instance);

        // Act
        var result = await repo.RemoveFriendShipOrFriendRequestAsync(UserIdWithFriend, RequesterUserId, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();

        // Verify the pending request is gone
        var outgoing = await repo.GetOutgoingRequestsAsync(UserIdWithFriend, u => FriendResponse.Create(u.Receiver!.Identifier, u.Receiver.NickName), CancellationToken.None);
        outgoing.IsSuccess.Should().BeTrue();
        outgoing.Value.Should().HaveCount(0);
    }

    [Fact]
    public async Task AcceptRequestAsync_WhenAlreadyAccepted_ReturnsNotFound()
    {
        // Arrange — seed has 1→2 Accepted; the filter requires Status==Pending so it should not be found
        var repo = new FriendRepository(CreateSeededFactory(), NullLogger<FriendRepository>.Instance);

        // Act
        var result = await repo.AcceptRequestAsync(UserIdWithFriend, FriendUserId, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task DeleteAllFriendRequestsByUserIdAsync_WhenFound_ActuallyDeletesRecords()
    {
        // Arrange — user 1 has rows as requester (1→2 Accepted, 1→3 Pending)
        var repo = new FriendRepository(CreateSeededFactory(), NullLogger<FriendRepository>.Instance);

        // Act
        var result = await repo.DeleteAllFriendRequestsByUserIdAsync(UserIdWithFriend, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();

        var friends = await repo.GetFriendsAsync(UserIdWithFriend, u => FriendResponse.Create(u.Identifier, u.NickName), CancellationToken.None);
        friends.Value.Should().HaveCount(0);

        var outgoing = await repo.GetOutgoingRequestsAsync(UserIdWithFriend, u => FriendResponse.Create(u.Receiver!.Identifier, u.Receiver.NickName), CancellationToken.None);
        outgoing.Value.Should().HaveCount(0);
    }
}
