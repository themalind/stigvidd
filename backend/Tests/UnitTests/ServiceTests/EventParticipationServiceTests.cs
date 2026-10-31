// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Core.Repositories;
using Core.Repositories.Events;
using Core.Services.Events;
using Core.Services.Push;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using UnitTests.RepositoryTests;
using WebDataContracts.RequestModels.Event;

namespace UnitTests.ServiceTests;

// Joining itself is covered by the integration tests: its conditional increment is ExecuteUpdateAsync, which EF InMemory cannot run. keep-comment: where the join tests live
public class EventParticipationServiceTests : TestBase
{
    private const string User1 = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
    private const string User2 = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";
    private const string User3 = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d67";

    private readonly Mock<IPushQueue> _pushQueue = new();

    private EventParticipationService Service(IDbContextFactory<StigViddDbContext> factory, params int[] hiddenUserIds)
    {
        var blocks = Utilities.MockFactory.UserBlockServiceHiding(hiddenUserIds).Object;

        return new EventParticipationService(
            new EventLoader(
                new EventRepository(factory, NullLogger<EventRepository>.Instance),
                new UserRepository(factory, NullLogger<UserRepository>.Instance),
                blocks),
            new EventParticipantRepository(factory, NullLogger<EventParticipantRepository>.Instance),
            new EventInvitationRepository(factory, NullLogger<EventInvitationRepository>.Instance),
            blocks,
            _pushQueue.Object);
    }

    private EventParticipationService ServiceWith(IDbContextFactory<StigViddDbContext> factory, IEventParticipantRepository participants)
    {
        var blocks = Utilities.MockFactory.UserBlockServiceHiding().Object;

        return new EventParticipationService(
            new EventLoader(
                new EventRepository(factory, NullLogger<EventRepository>.Instance),
                new UserRepository(factory, NullLogger<UserRepository>.Instance),
                blocks),
            participants,
            new EventInvitationRepository(factory, NullLogger<EventInvitationRepository>.Instance),
            blocks,
            _pushQueue.Object);
    }

    private static Event With(Event e, int userId, EventParticipantRole role = EventParticipantRole.Participant, EventParticipantStatus status = EventParticipantStatus.Joined)
    {
        e.Participants.Add(new EventParticipant { UserId = userId, Role = role, Status = status, JoinedAt = DateTime.UtcNow.AddMinutes(userId) });
        e.ParticipantCount = e.Participants.Count(p => p.Status == EventParticipantStatus.Joined);
        return e;
    }

    private static IDbContextFactory<StigViddDbContext> Seeded(Event e)
    {
        return CreateSeededFactory(db => db.Events.Add(e));
    }

    private static async Task<EventParticipant?> RowOf(IDbContextFactory<StigViddDbContext> factory, int userId)
    {
        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        return await context.EventParticipants.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == userId, TestContext.Current.CancellationToken);
    }

    // The counter must always equal the Joined rows. keep-comment: the invariant RecountAsync exists for
    private static async Task CountMatchesJoinedRows(IDbContextFactory<StigViddDbContext> factory)
    {
        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var stored = await context.Events.SingleAsync(TestContext.Current.CancellationToken);
        var joined = await context.EventParticipants.CountAsync(p => p.EventId == stored.Id && p.Status == EventParticipantStatus.Joined, TestContext.Current.CancellationToken);
        stored.ParticipantCount.Should().Be(joined);
    }

    [Fact]
    public async Task JoinAsync_WhenAlreadyJoined_IsOkAndChangesNothing()
    {
        var factory = Seeded(With(EventRepositoryTests.NewEvent(1, organizerId: 2), 1));

        var result = await Service(factory).JoinAsync(User1, "event-1", TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        await CountMatchesJoinedRows(factory);
    }

    [Fact]
    public async Task JoinAsync_AfterBeingRemoved_Is409RemovedFromEvent()
    {
        var factory = Seeded(With(EventRepositoryTests.NewEvent(1, organizerId: 2), 1, status: EventParticipantStatus.Removed));

        var result = await Service(factory).JoinAsync(User1, "event-1", TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(409);
        result.Message.Code.Should().Be(EventErrorCodes.RemovedFromEvent);
    }

    [Fact]
    public async Task JoinAsync_WhenNoSpotIsTakenAndTheEventIsUnchanged_Is409EventFull()
    {
        var factory = Seeded(EventRepositoryTests.NewEvent(1, organizerId: 2));
        var participants = new Mock<IEventParticipantRepository>();
        participants
            .Setup(r => r.JoinAsync(1, 1, It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Conflict());

        var result = await ServiceWith(factory, participants.Object).JoinAsync(User1, "event-1", TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(409);
        result.Message.Code.Should().Be(EventErrorCodes.EventFull);
    }

    [Fact]
    public async Task JoinAsync_WhenTheEventIsCancelledBeforeTheSpotIsTaken_NamesTheCancellation()
    {
        var factory = Seeded(EventRepositoryTests.NewEvent(1, organizerId: 2));
        var participants = new Mock<IEventParticipantRepository>();
        participants
            .Setup(r => r.JoinAsync(1, 1, It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .Returns(async () =>
            {
                using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
                var stored = await context.Events.SingleAsync(TestContext.Current.CancellationToken);
                stored.Status = EventStatus.Cancelled;
                await context.SaveChangesAsync(TestContext.Current.CancellationToken);
                return RepositoryResult.Conflict();
            });

        var result = await ServiceWith(factory, participants.Object).JoinAsync(User1, "event-1", TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(409);
        result.Message.Code.Should().Be(EventErrorCodes.EventCancelled);
    }

    [Fact]
    public async Task MarkInterested_ThenUnmark_AddsAndRemovesTheRowWithoutTakingASpot()
    {
        var factory = Seeded(EventRepositoryTests.NewEvent(1, organizerId: 2));
        var service = Service(factory);

        var marked = await service.MarkInterestedAsync(User1, "event-1", TestContext.Current.CancellationToken);
        var row = await RowOf(factory, 1);
        await CountMatchesJoinedRows(factory);
        var unmarked = await service.UnmarkInterestedAsync(User1, "event-1", TestContext.Current.CancellationToken);
        var again = await service.UnmarkInterestedAsync(User1, "event-1", TestContext.Current.CancellationToken);

        marked.Success.Should().BeTrue();
        row.Should().NotBeNull();
        row.Status.Should().Be(EventParticipantStatus.Interested);
        unmarked.Success.Should().BeTrue();
        again.Success.Should().BeTrue();
        (await RowOf(factory, 1)).Should().BeNull();
    }

    [Fact]
    public async Task MarkInterested_WhenJoined_Is409()
    {
        var factory = Seeded(With(EventRepositoryTests.NewEvent(1, organizerId: 2), 1));

        var result = await Service(factory).MarkInterestedAsync(User1, "event-1", TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task UnmarkInterested_DoesNotTouchAJoinedRow()
    {
        var factory = Seeded(With(EventRepositoryTests.NewEvent(1, organizerId: 2), 1));

        var result = await Service(factory).UnmarkInterestedAsync(User1, "event-1", TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        (await RowOf(factory, 1)).Should().NotBeNull();
    }

    [Fact]
    public async Task LeaveAsync_AsAParticipant_DeletesTheRowAndRecounts()
    {
        var factory = Seeded(With(EventRepositoryTests.NewEvent(1, organizerId: 2), 1));

        var result = await Service(factory).LeaveAsync(User1, "event-1", TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        (await RowOf(factory, 1)).Should().BeNull();
        await CountMatchesJoinedRows(factory);
    }

    [Fact]
    public async Task LeaveAsync_AsOrganizer_HandsOverToTheCoHostAndPushes()
    {
        var factory = Seeded(With(EventRepositoryTests.NewEvent(1, organizerId: 1), 3, EventParticipantRole.CoHost));

        var result = await Service(factory).LeaveAsync(User1, "event-1", TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        var successor = await RowOf(factory, 3);
        successor.Should().NotBeNull();
        successor.Role.Should().Be(EventParticipantRole.Organizer);
        _pushQueue.Verify(q => q.Enqueue(It.Is<PushMessage>(m => m.Data["type"].Equals(PushTypes.EventPromoted) && m.UserIds.Contains(3))), Times.Once);
        await CountMatchesJoinedRows(factory);
    }

    [Fact]
    public async Task LeaveAsync_WhenRemoved_KeepsTheRowSoTheyCannotRejoin()
    {
        var factory = Seeded(With(EventRepositoryTests.NewEvent(1, organizerId: 2), 1, status: EventParticipantStatus.Removed));

        var result = await Service(factory).LeaveAsync(User1, "event-1", TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        var row = await RowOf(factory, 1);
        row.Should().NotBeNull();
        row.Status.Should().Be(EventParticipantStatus.Removed);
    }

    [Fact]
    public async Task LeaveAsync_AnEventThatIsGone_IsOk()
    {
        var result = await Service(CreateSeededFactory()).LeaveAsync(User1, "no-such-event", TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task GetParticipantsAsync_ForAJoinedViewer_ListsThemWithoutHiddenUsers()
    {
        var factory = Seeded(With(With(EventRepositoryTests.NewEvent(1, organizerId: 2), 1), 3));

        var result = await Service(factory, hiddenUserIds: 3).GetParticipantsAsync(User1, "event-1", TestContext.Current.CancellationToken);

        result.Value.Should().NotBeNull();
        result.Value.ParticipantCount.Should().Be(3);
        result.Value.Participants.Should().NotBeNull();
        result.Value.Participants.Select(p => p.NickName).Should().Equal("VandrarVennen", "NaturElskaren");
        result.Value.Participants.First().Role.Should().Be("Organizer");
    }

    [Theory]
    [InlineData(EventParticipantRole.CoHost)]
    [InlineData(EventParticipantRole.Organizer)]
    public async Task GetParticipantsAsync_ForAHost_ListsUsersTheyBlocked_SoTheyCanRemoveThem(EventParticipantRole viewerRole)
    {
        var e = viewerRole == EventParticipantRole.Organizer
            ? With(EventRepositoryTests.NewEvent(1, organizerId: 1), 3)
            : With(With(EventRepositoryTests.NewEvent(1, organizerId: 2), 1, EventParticipantRole.CoHost), 3);
        var factory = Seeded(e);

        var result = await Service(factory, hiddenUserIds: 3).GetParticipantsAsync(User1, "event-1", TestContext.Current.CancellationToken);

        result.Value.Should().NotBeNull();
        result.Value.Participants.Should().NotBeNull();
        result.Value.Participants.Should().Contain(p => p.UserIdentifier == User3);
    }

    [Fact]
    public async Task GetParticipantsAsync_ForAnOutsider_GivesCountsOnly()
    {
        var factory = Seeded(With(With(EventRepositoryTests.NewEvent(1, organizerId: 2), 3), 1, status: EventParticipantStatus.Interested));

        var result = await Service(factory).GetParticipantsAsync(User1, "event-1", TestContext.Current.CancellationToken);

        result.Value.Should().NotBeNull();
        result.Value.ParticipantCount.Should().Be(2);
        result.Value.InterestedCount.Should().Be(1);
        result.Value.Participants.Should().BeNull();
        result.Value.Invited.Should().BeNull();
    }

    [Theory]
    [InlineData(EventParticipantRole.Organizer, new[] { "VandrarVennen", "SkogsGreven" }, "SkogsGreven")]
    [InlineData(EventParticipantRole.Participant, new[] { "VandrarVennen" }, null)]
    public async Task GetParticipantsAsync_ListsPendingInvitees_WithoutBlockedOnesForANonHost(EventParticipantRole viewerRole, string[] expected, string? firstInviter)
    {
        var e = viewerRole == EventParticipantRole.Organizer
            ? EventRepositoryTests.NewEvent(1, organizerId: 1)
            : With(EventRepositoryTests.NewEvent(1, organizerId: 4), 1);
        e.Invitations.Add(new EventInvitation { InvitedUserId = 2, InvitedByUserId = 3, CreatedAt = DateTime.UtcNow.AddHours(-2) });
        e.Invitations.Add(new EventInvitation { InvitedUserId = 3, InvitedByUserId = 1, CreatedAt = DateTime.UtcNow.AddHours(-1) });
        e.Invitations.Add(new EventInvitation { InvitedUserId = 4, Status = EventInvitationStatus.Declined });
        var factory = Seeded(e);

        var result = await Service(factory, hiddenUserIds: 3).GetParticipantsAsync(User1, "event-1", TestContext.Current.CancellationToken);

        result.Value.Should().NotBeNull();
        result.Value.Invited.Should().NotBeNull();
        result.Value.Invited.Select(i => i.NickName).Should().Equal(expected);
        result.Value.Invited.First().InvitedByNickName.Should().Be(firstInviter);
    }

    [Fact]
    public async Task RemoveParticipantAsync_ByACoHost_MarksThemRemovedAndRecounts()
    {
        var factory = Seeded(With(With(EventRepositoryTests.NewEvent(1, organizerId: 2), 1, EventParticipantRole.CoHost), 3));

        var result = await Service(factory).RemoveParticipantAsync(User1, "event-1", User3, TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        var row = await RowOf(factory, 3);
        row.Should().NotBeNull();
        row.Status.Should().Be(EventParticipantStatus.Removed);
        await CountMatchesJoinedRows(factory);
    }

    [Fact]
    public async Task RemoveParticipantAsync_ACoHostRemovingAnotherCoHost_Is403()
    {
        var factory = Seeded(With(With(EventRepositoryTests.NewEvent(1, organizerId: 2), 1, EventParticipantRole.CoHost), 3, EventParticipantRole.CoHost));

        var result = await Service(factory).RemoveParticipantAsync(User1, "event-1", User3, TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(403);
        result.Message.Code.Should().Be(EventErrorCodes.NotAllowed);
    }

    [Fact]
    public async Task RemoveParticipantAsync_ByAParticipant_Is403()
    {
        var factory = Seeded(With(With(EventRepositoryTests.NewEvent(1, organizerId: 2), 1), 3));

        var result = await Service(factory).RemoveParticipantAsync(User1, "event-1", User3, TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(403);
    }

    [Fact]
    public async Task RemoveParticipantAsync_SomeoneWhoAlreadyLeft_IsOk()
    {
        var factory = Seeded(EventRepositoryTests.NewEvent(1, organizerId: 1));

        var result = await Service(factory).RemoveParticipantAsync(User1, "event-1", User3, TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task RemoveParticipantAsync_Yourself_Is400()
    {
        var factory = Seeded(EventRepositoryTests.NewEvent(1, organizerId: 1));

        var result = await Service(factory).RemoveParticipantAsync(User1, "event-1", User1, TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task SetRoleAsync_PromotingAParticipant_MakesThemCoHostAndPushes()
    {
        var factory = Seeded(With(EventRepositoryTests.NewEvent(1, organizerId: 1), 3));

        var result = await Service(factory).SetRoleAsync(User1, "event-1", User3, new EventRoleRequest { Role = "CoHost" }, TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        var row = await RowOf(factory, 3);
        row.Should().NotBeNull();
        row.Role.Should().Be(EventParticipantRole.CoHost);
        _pushQueue.Verify(q => q.Enqueue(It.Is<PushMessage>(m => m.Data["type"].Equals(PushTypes.EventPromoted) && m.UserIds.Contains(3) && m.FromUserId == 1)), Times.Once);
    }

    [Fact]
    public async Task SetRoleAsync_OnAPastEvent_Is409EventPastAndPushesNothing()
    {
        var factory = Seeded(With(EventRepositoryTests.NewEvent(1, organizerId: 1, startsInDays: -3), 3));

        var result = await Service(factory).SetRoleAsync(User1, "event-1", User3, new EventRoleRequest { Role = "CoHost" }, TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(409);
        result.Message.Code.Should().Be(EventErrorCodes.EventPast);
        (await RowOf(factory, 3))?.Role.Should().Be(EventParticipantRole.Participant);
        _pushQueue.Verify(q => q.Enqueue(It.IsAny<PushMessage>()), Times.Never);
    }

    [Fact]
    public async Task SetRoleAsync_Demoting_SendsNoPush()
    {
        var factory = Seeded(With(EventRepositoryTests.NewEvent(1, organizerId: 1), 3, EventParticipantRole.CoHost));

        var result = await Service(factory).SetRoleAsync(User1, "event-1", User3, new EventRoleRequest { Role = "Participant" }, TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        (await RowOf(factory, 3))?.Role.Should().Be(EventParticipantRole.Participant);
        _pushQueue.Verify(q => q.Enqueue(It.IsAny<PushMessage>()), Times.Never);
    }

    [Fact]
    public async Task SetRoleAsync_ByACoHost_Is403()
    {
        var factory = Seeded(With(With(EventRepositoryTests.NewEvent(1, organizerId: 2), 1, EventParticipantRole.CoHost), 3));

        var result = await Service(factory).SetRoleAsync(User1, "event-1", User3, new EventRoleRequest { Role = "CoHost" }, TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(403);
    }

    [Fact]
    public async Task SetRoleAsync_OnTheOrganizer_Is400()
    {
        var factory = Seeded(EventRepositoryTests.NewEvent(1, organizerId: 1));

        var result = await Service(factory).SetRoleAsync(User1, "event-1", User1, new EventRoleRequest { Role = "Participant" }, TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task SetRoleAsync_OnSomeoneOnlyInterested_Is404()
    {
        var factory = Seeded(With(EventRepositoryTests.NewEvent(1, organizerId: 1), 3, status: EventParticipantStatus.Interested));

        var result = await Service(factory).SetRoleAsync(User1, "event-1", User3, new EventRoleRequest { Role = "CoHost" }, TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Theory]
    [InlineData(3, new[] { EventParticipantRole.Participant })]
    [InlineData(2, new[] { EventParticipantRole.CoHost, EventParticipantRole.Participant })]
    public async Task Repository_RemoveAsync_ATargetWhoseRoleIsNotRemovable_IsConflictAndChangesNothing(int targetUserId, EventParticipantRole[] removable)
    {
        var factory = Seeded(With(EventRepositoryTests.NewEvent(1, organizerId: 2), 3, EventParticipantRole.CoHost));
        var repository = new EventParticipantRepository(factory, NullLogger<EventParticipantRepository>.Instance);

        var result = await repository.RemoveAsync(1, targetUserId, removable, TestContext.Current.CancellationToken);

        result.Status.Should().Be(RepositoryResultStatus.Conflict);
        (await RowOf(factory, targetUserId))?.Status.Should().Be(EventParticipantStatus.Joined);
    }

    [Fact]
    public async Task Repository_SetRoleAsync_OnTheOrganizer_IsConflictAndKeepsTheRole()
    {
        var factory = Seeded(EventRepositoryTests.NewEvent(1, organizerId: 2));
        var repository = new EventParticipantRepository(factory, NullLogger<EventParticipantRepository>.Instance);

        var result = await repository.SetRoleAsync(1, 2, EventParticipantRole.Participant, TestContext.Current.CancellationToken);

        result.Status.Should().Be(RepositoryResultStatus.Conflict);
        (await RowOf(factory, 2))?.Role.Should().Be(EventParticipantRole.Organizer);
    }

    // The role changed between the service's check and the write, e.g. a hand-over promoted the target. keep-comment: the race the repository's Conflict reports
    [Fact]
    public async Task RemoveParticipantAsync_WhenTheTargetsRoleChangedMeanwhile_Is403NotAllowed()
    {
        var factory = Seeded(With(EventRepositoryTests.NewEvent(1, organizerId: 2), 1, EventParticipantRole.CoHost));
        var participants = new Mock<IEventParticipantRepository>();
        participants.Setup(r => r.GetAsync(1, User3, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<EventParticipantRow>.Success(new EventParticipantRow(3, User3, "Nick", EventParticipantRole.Participant, EventParticipantStatus.Joined, DateTime.UtcNow)));
        participants.Setup(r => r.RemoveAsync(1, 3, It.IsAny<IReadOnlyCollection<EventParticipantRole>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Conflict());

        var result = await ServiceWith(factory, participants.Object).RemoveParticipantAsync(User1, "event-1", User3, TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(403);
        result.Message.Code.Should().Be(EventErrorCodes.NotAllowed);
        participants.Verify(r => r.RemoveAsync(1, 3, It.Is<IReadOnlyCollection<EventParticipantRole>>(roles => roles.SequenceEqual(new[] { EventParticipantRole.Participant })), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SetRoleAsync_WhenTheTargetBecameOrganizerMeanwhile_Is400AndPushesNothing()
    {
        var factory = Seeded(EventRepositoryTests.NewEvent(1, organizerId: 1));
        var participants = new Mock<IEventParticipantRepository>();
        participants.Setup(r => r.GetAsync(1, User3, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<EventParticipantRow>.Success(new EventParticipantRow(3, User3, "Nick", EventParticipantRole.CoHost, EventParticipantStatus.Joined, DateTime.UtcNow)));
        participants.Setup(r => r.SetRoleAsync(1, 3, EventParticipantRole.Participant, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Conflict());

        var result = await ServiceWith(factory, participants.Object).SetRoleAsync(User1, "event-1", User3, new EventRoleRequest { Role = "Participant" }, TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(400);
        _pushQueue.Verify(q => q.Enqueue(It.IsAny<PushMessage>()), Times.Never);
    }

    [Fact]
    public async Task SetMutedAsync_ForAParticipant_SavesIt()
    {
        var factory = Seeded(With(EventRepositoryTests.NewEvent(1, organizerId: 2), 1));

        var result = await Service(factory).SetMutedAsync(User1, "event-1", new EventMuteRequest { Muted = true }, TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        (await RowOf(factory, 1))?.MutePosts.Should().BeTrue();
    }

    [Fact]
    public async Task SetMutedAsync_ForSomeoneNotJoined_Is403()
    {
        var factory = Seeded(EventRepositoryTests.NewEvent(1, organizerId: 2));

        var result = await Service(factory).SetMutedAsync(User1, "event-1", new EventMuteRequest { Muted = true }, TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(403);
    }

    [Fact]
    public async Task GetParticipantsAsync_ForTheOrganizer_ListsThemselves()
    {
        var factory = Seeded(EventRepositoryTests.NewEvent(1, organizerId: 2));

        var result = await Service(factory).GetParticipantsAsync(User2, "event-1", TestContext.Current.CancellationToken);

        result.Value.Should().NotBeNull();
        result.Value.Participants.Should().ContainSingle().Which.Role.Should().Be("Organizer");
    }
}
