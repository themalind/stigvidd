using Core.Repositories;
using FluentAssertions;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.Extensions.Logging.Abstractions;

namespace UnitTests.RepositoryTests;

public class HikeShareRecipientRepositoryTests : TestBase
{
    // Seeded HikeShares:
    //   HikeId=1, SharedWithId=2, SharedById=1
    //   HikeId=2, SharedWithId=3, SharedById=1
    //   HikeId=3, SharedWithId=1, SharedById=2
    //   HikeId=4, SharedWithId=4, SharedById=2
    //   HikeId=5, SharedWithId=5, SharedById=3

    // Seeded HikeShares (all Accepted after seed fix):
    //   HikeId=1, SharedWithId=2  (Hike1 accepted for User2)
    //   HikeId=2, SharedWithId=3  (Hike2 accepted for User3)
    //   HikeId=3, SharedWithId=1  (Hike3 accepted for User1)
    //   HikeId=4, SharedWithId=4  (Hike4 accepted for User4)
    //   HikeId=5, SharedWithId=5  (Hike5 accepted for User5)

    private const int User1Id = 1;
    private const int User2Id = 2;
    private const int User6Id = 6;
    private const int Hike1Id = 1;
    private const int Hike2Id = 2;
    private const int Hike6Id = 6;

    private const string User1Identifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
    private const string User6Identifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5a44";

    // Hike3 is Accepted for User1; Hike2 has no existing share with User1 (used for pending tests)
    private const string Hike2Identifier = "b7a2d4c1-5e9f-4a63-8c1d-0f2e7b9a6c34";
    private const string Hike3Identifier = "91e4c2d7-3b8f-4f6a-9d1c-7a2e5b0c8f13";

    [Fact]
    public async Task GetAllHikesSharedWithUserAsync_WhenSharesExist_ReturnsHikes()
    {
        // Arrange — Hike3 is shared with User1
        var repo = new HikeShareRecipientRepository(CreateSeededFactory(), NullLogger<HikeShareRecipientRepository>.Instance);

        // Act
        var result = await repo.GetAllHikesSharedWithUserAsync(User1Identifier, hs => hs.HikeId, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetAllHikesSharedWithUserAsync_WhenNoSharesExist_ReturnsEmptyCollection()
    {
        // Arrange — User6 has nothing shared with them
        var repo = new HikeShareRecipientRepository(CreateSeededFactory(), NullLogger<HikeShareRecipientRepository>.Instance);

        // Act
        var result = await repo.GetAllHikesSharedWithUserAsync(User6Identifier, hs => hs.HikeId, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task HasHikeSharedWithUserAsync_WhenShared_ReturnsTrue()
    {
        // Arrange — Hike1 is shared with User2
        var repo = new HikeShareRecipientRepository(CreateSeededFactory(), NullLogger<HikeShareRecipientRepository>.Instance);

        // Act
        var result = await repo.HasHikeSharedWithUserAsync(User2Id, Hike1Id, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeTrue();
    }

    [Fact]
    public async Task HasHikeSharedWithUserAsync_WhenNotShared_ReturnsFalse()
    {
        // Arrange — Hike1 is not shared with User6
        var repo = new HikeShareRecipientRepository(CreateSeededFactory(), NullLogger<HikeShareRecipientRepository>.Instance);

        // Act
        var result = await repo.HasHikeSharedWithUserAsync(User6Id, Hike1Id, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeFalse();
    }

    [Fact]
    public async Task HasHikeSharedWithUserAsync_WhenShareIsPending_ReturnsTrue()
    {
        // Arrange — add a Pending share: Hike2 pending for User1
        var factory = CreateSeededFactory(ctx =>
            ctx.HikeShares.Add(new HikeShare { HikeId = Hike2Id, SharedWithId = User1Id, SharedById = User2Id, Status = HikeShareStatus.Pending }));
        var repo = new HikeShareRecipientRepository(factory, NullLogger<HikeShareRecipientRepository>.Instance);

        // Act
        var result = await repo.HasHikeSharedWithUserAsync(User1Id, Hike2Id, CancellationToken.None);

        // Assert — a pending share must be detected to prevent duplicate requests
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteHikeShareAsync_WhenExists_ReturnsSuccess()
    {
        // Arrange — Hike1 is shared with User2
        var repo = new HikeShareRecipientRepository(CreateSeededFactory(), NullLogger<HikeShareRecipientRepository>.Instance);

        // Act
        var result = await repo.DeleteHikeShareAsync(Hike1Id, User2Id, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteHikeShareAsync_WhenExists_RemovesTheShare()
    {
        // Arrange
        var factory = CreateSeededFactory();
        var repo = new HikeShareRecipientRepository(factory, NullLogger<HikeShareRecipientRepository>.Instance);

        // Act
        await repo.DeleteHikeShareAsync(Hike1Id, User2Id, CancellationToken.None);
        var verify = await repo.HasHikeSharedWithUserAsync(User2Id, Hike1Id, CancellationToken.None);

        // Assert
        verify.IsSuccess.Should().BeTrue();
        verify.Value.Should().BeFalse();
    }

    [Fact]
    public async Task DeleteHikeShareAsync_WhenNotExists_ReturnsSuccess()
    {
        // Arrange — Hike6 is not shared with User1
        var repo = new HikeShareRecipientRepository(CreateSeededFactory(), NullLogger<HikeShareRecipientRepository>.Instance);

        // Act
        var result = await repo.DeleteHikeShareAsync(Hike6Id, User1Id, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenValid_ReturnsSuccess()
    {
        // Arrange — add a new share: Hike6 shared with User2 by User5
        var repo = new HikeShareRecipientRepository(CreateSeededFactory(), NullLogger<HikeShareRecipientRepository>.Instance);
        var hikeShare = new HikeShare { HikeId = 6, SharedById = 5, SharedWithId = 2 };

        // Act
        var result = await repo.ReshareSharedHikeAsync(hikeShare, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenAdded_IsDetectableAsPendingShare()
    {
        // Arrange — reshare creates a Pending share; the recipient must accept before it becomes Accepted
        var factory = CreateSeededFactory();
        var repo = new HikeShareRecipientRepository(factory, NullLogger<HikeShareRecipientRepository>.Instance);
        var hikeShare = new HikeShare { HikeId = 6, SharedById = 5, SharedWithId = 2 };

        // Act
        await repo.ReshareSharedHikeAsync(hikeShare, CancellationToken.None);
        var verify = await repo.GetPendingSharesForUserAsync(User2Id, hs => hs.HikeId, CancellationToken.None);

        // Assert
        verify.IsSuccess.Should().BeTrue();
        verify.Value.Should().Contain(Hike6Id);
    }

    // GetPendingSharesForUserAsync

    [Fact]
    public async Task GetPendingSharesForUserAsync_WhenPendingSharesExist_ReturnsPendingShares()
    {
        // Arrange — add a pending share: Hike2 is pending for User1 from User2
        var factory = CreateSeededFactory(ctx =>
            ctx.HikeShares.Add(new HikeShare { HikeId = Hike2Id, SharedWithId = User1Id, SharedById = User2Id, Status = HikeShareStatus.Pending }));
        var repo = new HikeShareRecipientRepository(factory, NullLogger<HikeShareRecipientRepository>.Instance);

        // Act
        var result = await repo.GetPendingSharesForUserAsync(User1Id, hs => hs.HikeId, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(1);
        result.Value.Should().Contain(Hike2Id);
    }

    [Fact]
    public async Task GetPendingSharesForUserAsync_WhenNoPendingShares_ReturnsEmptyCollection()
    {
        // Arrange — User6 has no pending shares
        var repo = new HikeShareRecipientRepository(CreateSeededFactory(), NullLogger<HikeShareRecipientRepository>.Instance);

        // Act
        var result = await repo.GetPendingSharesForUserAsync(User6Id, hs => hs.HikeId, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task GetPendingSharesForUserAsync_WhenShareIsAccepted_DoesNotIncludeIt()
    {
        // Arrange — User1 has Hike3 as Accepted; add no pending shares
        var repo = new HikeShareRecipientRepository(CreateSeededFactory(), NullLogger<HikeShareRecipientRepository>.Instance);

        // Act
        var result = await repo.GetPendingSharesForUserAsync(User1Id, hs => hs.HikeId, CancellationToken.None);

        // Assert — Hike3 (Accepted) must not appear in pending results
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    // GetPendingShareByIdentifierAsync

    [Fact]
    public async Task GetPendingShareByIdentifierAsync_WhenPendingShareExists_ReturnsShare()
    {
        // Arrange — Hike2 is pending for User1; project to the hike identifier (string, reference type)
        // so FirstOrDefaultAsync returns null — not default(int) — when no row is found
        var factory = CreateSeededFactory(ctx =>
            ctx.HikeShares.Add(new HikeShare { HikeId = Hike2Id, SharedWithId = User1Id, SharedById = User2Id, Status = HikeShareStatus.Pending }));
        var repo = new HikeShareRecipientRepository(factory, NullLogger<HikeShareRecipientRepository>.Instance);

        // Act
        var result = await repo.GetPendingShareByIdentifierAsync(User1Id, Hike2Identifier, hs => hs.Hike!.Identifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be(Hike2Identifier);
    }

    [Fact]
    public async Task GetPendingShareByIdentifierAsync_WhenNotFound_ReturnsNotFound()
    {
        // Arrange — no pending share for User6/Hike2
        var repo = new HikeShareRecipientRepository(CreateSeededFactory(), NullLogger<HikeShareRecipientRepository>.Instance);

        // Act
        var result = await repo.GetPendingShareByIdentifierAsync(User6Id, Hike2Identifier, hs => hs.Hike!.Identifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task GetPendingShareByIdentifierAsync_WhenShareIsAccepted_ReturnsNotFound()
    {
        // Arrange — Hike3 is Accepted for User1; the query filters on Status = Pending so no match
        var repo = new HikeShareRecipientRepository(CreateSeededFactory(), NullLogger<HikeShareRecipientRepository>.Instance);

        // Act
        var result = await repo.GetPendingShareByIdentifierAsync(User1Id, Hike3Identifier, hs => hs.Hike!.Identifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    // AcceptHikeShareAsync

    [Fact]
    public async Task AcceptHikeShareAsync_WhenPendingShareExists_ReturnsSuccess()
    {
        // Arrange — Hike2 is pending for User1
        var factory = CreateSeededFactory(ctx =>
            ctx.HikeShares.Add(new HikeShare { HikeId = Hike2Id, SharedWithId = User1Id, SharedById = User2Id, Status = HikeShareStatus.Pending }));
        var repo = new HikeShareRecipientRepository(factory, NullLogger<HikeShareRecipientRepository>.Instance);

        // Act
        var result = await repo.AcceptHikeShareAsync(Hike2Id, User1Id, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task AcceptHikeShareAsync_WhenPendingShareExists_ChangesStatusToAccepted()
    {
        // Arrange — Hike2 is pending for User1
        var factory = CreateSeededFactory(ctx =>
            ctx.HikeShares.Add(new HikeShare { HikeId = Hike2Id, SharedWithId = User1Id, SharedById = User2Id, Status = HikeShareStatus.Pending }));
        var repo = new HikeShareRecipientRepository(factory, NullLogger<HikeShareRecipientRepository>.Instance);

        // Act
        await repo.AcceptHikeShareAsync(Hike2Id, User1Id, CancellationToken.None);
        var verify = await repo.HasHikeSharedWithUserAsync(User1Id, Hike2Id, CancellationToken.None);

        // Assert — share is now Accepted so it shows up in accepted queries
        verify.IsSuccess.Should().BeTrue();
        verify.Value.Should().BeTrue();
    }

    [Fact]
    public async Task AcceptHikeShareAsync_WhenNoPendingShare_ReturnsNotFound()
    {
        // Arrange — no pending share for User6/Hike1
        var repo = new HikeShareRecipientRepository(CreateSeededFactory(), NullLogger<HikeShareRecipientRepository>.Instance);

        // Act
        var result = await repo.AcceptHikeShareAsync(Hike1Id, User6Id, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    // RejectHikeShareAsync

    [Fact]
    public async Task RejectHikeShareAsync_WhenPendingShareExists_ReturnsSuccess()
    {
        // Arrange — Hike2 is pending for User1
        var factory = CreateSeededFactory(ctx =>
            ctx.HikeShares.Add(new HikeShare { HikeId = Hike2Id, SharedWithId = User1Id, SharedById = User2Id, Status = HikeShareStatus.Pending }));
        var repo = new HikeShareRecipientRepository(factory, NullLogger<HikeShareRecipientRepository>.Instance);

        // Act
        var result = await repo.RejectHikeShareAsync(Hike2Id, User1Id, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task RejectHikeShareAsync_WhenPendingShareExists_RemovesPendingShare()
    {
        // Arrange — Hike2 is pending for User1
        var factory = CreateSeededFactory(ctx =>
            ctx.HikeShares.Add(new HikeShare { HikeId = Hike2Id, SharedWithId = User1Id, SharedById = User2Id, Status = HikeShareStatus.Pending }));
        var repo = new HikeShareRecipientRepository(factory, NullLogger<HikeShareRecipientRepository>.Instance);

        // Act
        await repo.RejectHikeShareAsync(Hike2Id, User1Id, CancellationToken.None);
        var verify = await repo.GetPendingSharesForUserAsync(User1Id, hs => hs.HikeId, CancellationToken.None);

        // Assert
        verify.IsSuccess.Should().BeTrue();
        verify.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task RejectHikeShareAsync_WhenNoPendingShare_ReturnsNotFound()
    {
        // Arrange — no pending share for User6/Hike1
        var repo = new HikeShareRecipientRepository(CreateSeededFactory(), NullLogger<HikeShareRecipientRepository>.Instance);

        // Act
        var result = await repo.RejectHikeShareAsync(Hike1Id, User6Id, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }
}
