// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Repositories;
using AwesomeAssertions;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
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
        var result = await repo.GetFriendsAsync(UserIdWithFriend, [], u => FriendResponse.Create(u.Identifier, u.NickName), TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetFriendsAsync_ReturnsFriendsInNameOrder()
    {
        // Arrange
        const int userId = 100;
        var factory = CreateSeededFactory(db =>
        {
            db.Users.Add(new User { Id = userId, NickName = "me", Email = "me@test", SubjectId = "me" });
            var friendId = userId;
            foreach (var name in new[] { "cissi", "anna", "bertil" })
            {
                friendId++;
                db.Users.Add(new User { Id = friendId, NickName = name, Email = $"{name}@test", SubjectId = name });
                db.FriendRequests.Add(new FriendRequest
                {
                    RequesterId = friendId % 2 == 0 ? userId : friendId,
                    ReceiverId = friendId % 2 == 0 ? friendId : userId,
                    Status = FriendRequestStatus.Accepted,
                });
            }
        });
        var repo = new FriendRepository(factory, NullLogger<FriendRepository>.Instance);

        // Act
        var result = await repo.GetFriendsAsync(userId, [], u => u.NickName, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Equal("anna", "bertil", "cissi");
    }

    [Fact]
    public async Task SetNoteAsync_AddsThenReplacesThenRemoves()
    {
        // Arrange
        var repo = new FriendRepository(CreateSeededFactory(), NullLogger<FriendRepository>.Instance);
        var ct = TestContext.Current.CancellationToken;

        // Act & Assert
        (await repo.SetNoteAsync(UserIdWithFriend, FriendUserId, "Kusin", ct)).IsSuccess.Should().BeTrue();
        (await NotesOf(repo, UserIdWithFriend)).Values.Should().Equal("Kusin");

        (await repo.SetNoteAsync(UserIdWithFriend, FriendUserId, "Kusin Emil", ct)).IsSuccess.Should().BeTrue();
        (await NotesOf(repo, UserIdWithFriend)).Values.Should().Equal("Kusin Emil");

        (await repo.SetNoteAsync(UserIdWithFriend, FriendUserId, null, ct)).IsSuccess.Should().BeTrue();
        (await NotesOf(repo, UserIdWithFriend)).Should().BeEmpty();
    }

    private static async Task<IReadOnlyDictionary<string, string>> NotesOf(FriendRepository repo, int ownerUserId)
    {
        var result = await repo.GetNotesByFriendIdentifierAsync(ownerUserId, TestContext.Current.CancellationToken);
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        return result.Value ?? new Dictionary<string, string>();
    }

    [Fact]
    public async Task GetNotesByFriendIdentifierAsync_GivesOnlyTheOwnersNotes()
    {
        // Arrange
        var repo = new FriendRepository(CreateSeededFactory(), NullLogger<FriendRepository>.Instance);
        var ct = TestContext.Current.CancellationToken;
        await repo.SetNoteAsync(UserIdWithFriend, FriendUserId, "min anteckning", ct);
        await repo.SetNoteAsync(FriendUserId, UserIdWithFriend, "hennes anteckning", ct);

        // Act
        var notes = await NotesOf(repo, UserIdWithFriend);

        // Assert
        notes.Values.Should().Equal("min anteckning");
    }

    [Fact]
    public async Task RemoveFriendShipOrFriendRequestAsync_ForgetsBothSidesNotes()
    {
        // Arrange
        var repo = new FriendRepository(CreateSeededFactory(), NullLogger<FriendRepository>.Instance);
        var ct = TestContext.Current.CancellationToken;
        await repo.SetNoteAsync(UserIdWithFriend, FriendUserId, "a", ct);
        await repo.SetNoteAsync(FriendUserId, UserIdWithFriend, "b", ct);

        // Act
        (await repo.RemoveFriendShipOrFriendRequestAsync(UserIdWithFriend, FriendUserId, ct)).IsSuccess.Should().BeTrue();

        // Assert
        (await NotesOf(repo, UserIdWithFriend)).Should().BeEmpty();
        (await NotesOf(repo, FriendUserId)).Should().BeEmpty();
    }

    [Fact]
    public async Task GetFriendsAync_WhenNotFound_ReturnsSuccess()
    {
        // Arrange
        var repo = new FriendRepository(CreateSeededFactory(), NullLogger<FriendRepository>.Instance);

        // Act
        var result = await repo.GetFriendsAsync(UserIdWithNoFriends, [], u => FriendResponse.Create(u.Identifier, u.NickName), TestContext.Current.CancellationToken);

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
        var result = await repo.FriendshipExistsAsync(UserIdWithFriend, FriendUserId, TestContext.Current.CancellationToken);

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
        var result = await repo.FriendshipExistsAsync(UserIdWithNoFriends, FriendUserId, TestContext.Current.CancellationToken);

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
        var result = await repo.FriendshipExistsAsync(UserIdWithFriend, RequesterUserId, TestContext.Current.CancellationToken);

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
        var result = await repo.FriendshipExistsAsync(UserIdWithFriend, 4, TestContext.Current.CancellationToken);

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
        var result = await repo.GetIncomingRequestsAsync(RequesterUserId, [], u => FriendResponse.Create(u.Requester!.Identifier, u.Requester.NickName), TestContext.Current.CancellationToken);

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
            [], u => FriendResponse.Create(u.Receiver!.Identifier, u.Receiver.NickName), TestContext.Current.CancellationToken);

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
        var result = await repo.GetOutgoingRequestsAsync(UserIdWithFriend, [], u => FriendResponse.Create(u.Receiver!.Identifier, u.Receiver.NickName), TestContext.Current.CancellationToken);

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
        var result = await repo.GetOutgoingRequestsAsync(UserIdWithNoFriends, [], u => FriendResponse.Create(u.Receiver!.Identifier, u.Receiver.NickName), TestContext.Current.CancellationToken);

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
        var result = await repo.RemoveFriendShipOrFriendRequestAsync(UserIdWithFriend, FriendUserId, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();

        // Verify that the friendship/request is removed
        var verify = await repo.FriendshipExistsAsync(UserIdWithFriend, FriendUserId, TestContext.Current.CancellationToken);
        verify.IsSuccess.Should().BeTrue();
        verify.Value.Should().BeFalse();
    }

    [Fact]
    public async Task RemoveFriendShipOrFriendRequestAsync_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new FriendRepository(CreateSeededFactory(), NullLogger<FriendRepository>.Instance);

        // Act
        var result = await repo.RemoveFriendShipOrFriendRequestAsync(UserIdWithNoFriends, FriendUserId, TestContext.Current.CancellationToken);

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
        var result = await repo.AcceptRequestAsync(RequesterUserId, UserWithNoIncomingRequestsUserId, TestContext.Current.CancellationToken);

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
        var result = await repo.AcceptRequestAsync(UserIdWithFriend, RequesterUserId, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();

        // Verify that the friendship is now accepted
        var verify = await repo.FriendshipExistsAsync(UserIdWithFriend, RequesterUserId, TestContext.Current.CancellationToken);
        verify.IsSuccess.Should().BeTrue();
        verify.Value.Should().BeTrue();
    }

    [Fact]
    public async Task RejectRequestAsync_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new FriendRepository(CreateSeededFactory(), NullLogger<FriendRepository>.Instance);

        // Act
        var result = await repo.RejectRequestAsync(RequesterUserId, UserWithNoIncomingRequestsUserId, TestContext.Current.CancellationToken);

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
        var result = await repo.RejectRequestAsync(UserIdWithFriend, RequesterUserId, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();

        // Verify that the friendship is now rejected (not accepted)
        var verify = await repo.FriendshipExistsAsync(UserIdWithFriend, RequesterUserId, TestContext.Current.CancellationToken);
        verify.IsSuccess.Should().BeTrue();
        verify.Value.Should().BeFalse();
    }

    [Fact]
    public async Task SendRequestAsync_WhenFound_ReturnsSuccess()
    {
        // Arrange
        var repo = new FriendRepository(CreateSeededFactory(), NullLogger<FriendRepository>.Instance);

        // Act
        var result = await repo.SendRequestAsync(UserIdWithNoFriends, FriendUserId, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task SendRequestAsync_WhenAlreadyExists_ReturnsConflict()
    {
        // Arrange
        var repo = new FriendRepository(CreateSeededFactory(), NullLogger<FriendRepository>.Instance);

        // Act
        var result = await repo.SendRequestAsync(UserIdWithFriend, FriendUserId, TestContext.Current.CancellationToken);

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
        var result = await repo.FriendshipExistsAsync(FriendUserId, UserIdWithFriend, TestContext.Current.CancellationToken);

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
        var result = await repo.GetFriendsAsync(FriendUserId, [], u => FriendResponse.Create(u.Identifier, u.NickName), TestContext.Current.CancellationToken);

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
        var result = await repo.RemoveFriendShipOrFriendRequestAsync(UserIdWithFriend, RequesterUserId, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();

        // Verify the pending request is gone
        var outgoing = await repo.GetOutgoingRequestsAsync(UserIdWithFriend, [], u => FriendResponse.Create(u.Receiver!.Identifier, u.Receiver.NickName), TestContext.Current.CancellationToken);
        outgoing.IsSuccess.Should().BeTrue();
        outgoing.Value.Should().HaveCount(0);
    }

    [Fact]
    public async Task AcceptRequestAsync_WhenAlreadyAccepted_ReturnsNotFound()
    {
        // Arrange — seed has 1→2 Accepted; the filter requires Status==Pending so it should not be found
        var repo = new FriendRepository(CreateSeededFactory(), NullLogger<FriendRepository>.Instance);

        // Act
        var result = await repo.AcceptRequestAsync(UserIdWithFriend, FriendUserId, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task DeleteAccount_DeletesTheirFriendRequestsInBothDirections()
    {
        // Arrange — user 1 has rows as requester (1→2 Accepted, 1→3 Pending)
        var factory = CreateSeededFactory();

        // Act
        await DeleteAccountAsync(factory, "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d");

        // Assert
        await using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var left = await context.FriendRequests
            .CountAsync(fr => fr.RequesterId == UserIdWithFriend || fr.ReceiverId == UserIdWithFriend, TestContext.Current.CancellationToken);
        left.Should().Be(0);
    }

    [Fact]
    public async Task GetFriendsSinceByIdentifierAsync_DatesEveryAcceptedFriendshipFromEitherSide()
    {
        var since = new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc);
        var factory = CreateSeededFactory(db =>
        {
            var request = db.FriendRequests.Local.Single(fr => fr.RequesterId == 3 && fr.ReceiverId == 4);
            request.CreatedAt = since;
        });
        var repo = new FriendRepository(factory, NullLogger<FriendRepository>.Instance);

        var asReceiver = await repo.GetFriendsSinceByIdentifierAsync(4, TestContext.Current.CancellationToken);
        var asRequester = await repo.GetFriendsSinceByIdentifierAsync(3, TestContext.Current.CancellationToken);

        asReceiver.IsSuccess.Should().BeTrue();
        asReceiver.Value.Should().BeEquivalentTo(new Dictionary<string, DateTime> { ["b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d67"] = since });
        asRequester.Value.Should().BeEquivalentTo(new Dictionary<string, DateTime> { ["b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d22"] = since });
    }

    [Fact]
    public async Task GetFriendsSinceByIdentifierAsync_DatesAFriendshipFromTheAcceptNotTheRequest()
    {
        var repo = new FriendRepository(CreateSeededFactory(), NullLogger<FriendRepository>.Instance);
        var ct = TestContext.Current.CancellationToken;
        (await repo.AcceptRequestAsync(UserIdWithFriend, RequesterUserId, ct)).IsSuccess.Should().BeTrue();

        var result = await repo.GetFriendsSinceByIdentifierAsync(RequesterUserId, ct);

        result.Value.Should().NotBeNull();
        result.Value?.Values.Should().HaveCount(2)
            .And.ContainSingle(since => since > DateTime.UtcNow.AddMinutes(-5));
    }

    [Fact]
    public async Task GetFriendsSinceByIdentifierAsync_LeavesOutPendingRequests()
    {
        var repo = new FriendRepository(CreateSeededFactory(), NullLogger<FriendRepository>.Instance);

        var result = await repo.GetFriendsSinceByIdentifierAsync(UserIdWithFriend, TestContext.Current.CancellationToken);

        result.Value.Should().NotBeNull();
        result.Value?.Keys.Should().Equal("b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e");
    }
}
