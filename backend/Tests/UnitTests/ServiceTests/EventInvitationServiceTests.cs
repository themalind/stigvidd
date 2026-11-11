// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Interfaces.Services;
using Core.Repositories;
using Core.Repositories.Events;
using Core.Services.Events;
using Core.Services.Push;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using UnitTests.RepositoryTests;
using WebDataContracts.RequestModels.Event;

namespace UnitTests.ServiceTests;

// Accepting is covered by the integration tests: it takes a spot through ExecuteUpdateAsync, which EF InMemory cannot run. keep-comment: where the accept tests live
public class EventInvitationServiceTests : TestBase
{
    private const string User1 = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
    private const string User2 = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";
    private const string User3 = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d67";
    private const string NickName2 = "VandrarVennen";
    private const string NickName3 = "SkogsGreven";
    private const string NickName4 = "Eremiten";

    private readonly List<PushMessage> _pushes = [];

    private EventInvitationService Service(IDbContextFactory<StigViddDbContext> factory, int invitedPerDay = 50, params int[] hiddenUserIds)
    {
        var blocks = Utilities.MockFactory.UserBlockServiceHiding(hiddenUserIds).Object;
        var queue = new Mock<IPushQueue>();
        queue.Setup(q => q.Enqueue(It.IsAny<PushMessage>())).Callback<PushMessage>(_pushes.Add);
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["PresentableBaseUrl"] = Utilities.Stubs.PresentableBaseUrl })
            .Build();

        return new EventInvitationService(
            new EventLoader(
                new EventRepository(factory, NullLogger<EventRepository>.Instance),
                new UserRepository(factory, NullLogger<UserRepository>.Instance),
                blocks),
            new EventInvitationRepository(factory, NullLogger<EventInvitationRepository>.Instance),
            new EventParticipantRepository(factory, NullLogger<EventParticipantRepository>.Instance),
            blocks,
            queue.Object,
            new EventResponseFactory(configuration),
            Options.Create(new EventLimits { InvitedPerDay = invitedPerDay }));
    }

    private static Event Private(int id = 1, int organizerId = 1, int startsInDays = 3)
    {
        return EventRepositoryTests.NewEvent(id, organizerId, visibility: EventVisibility.Private, startsInDays: startsInDays);
    }

    private static EventInviteRequest Invite(params string[] nickNames)
    {
        return new EventInviteRequest { NickNames = [.. nickNames] };
    }

    private static async Task<Dictionary<int, EventInvitation>> InvitationsOf(IDbContextFactory<StigViddDbContext> factory, int eventId = 1)
    {
        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        return await context.EventInvitations.AsNoTracking()
            .Where(i => i.EventId == eventId)
            .ToDictionaryAsync(i => i.InvitedUserId, TestContext.Current.CancellationToken);
    }

    private static async Task<int> InviteLogsOf(IDbContextFactory<StigViddDbContext> factory, int userId)
    {
        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        return await context.UserActionLogs.CountAsync(l => l.UserId == userId && l.Action == UserAction.EventInvited, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task InviteAsync_ByTheOrganizer_CreatesPendingInvitationsAndPushesAsTheInviter()
    {
        var factory = CreateSeededFactory(db => db.Events.Add(Private()));

        var result = await Service(factory).InviteAsync(User1, "event-1", Invite(NickName2, NickName3, NickName2), TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        var invitations = await InvitationsOf(factory);
        invitations.Keys.Should().BeEquivalentTo([2, 3]);
        invitations.Values.Should().AllSatisfy(i =>
        {
            i.Status.Should().Be(EventInvitationStatus.Pending);
            i.InvitedByUserId.Should().Be(1);
        });
        var push = _pushes.Should().ContainSingle().Subject;
        push.UserIds.Should().BeEquivalentTo([2, 3]);
        push.FromUserId.Should().Be(1);
        push.Data["type"].Should().Be(PushTypes.EventInvite);
        push.Data["eventIdentifier"].Should().Be("event-1");
        push.Body.Should().Be("NaturElskaren bjöd in dig till Event 1");
        (await InviteLogsOf(factory, 1)).Should().Be(2);
    }

    [Fact]
    public async Task InviteAsync_WithAnUnknownNickname_InvitesNobodyAndNamesIt()
    {
        var factory = CreateSeededFactory(db => db.Events.Add(Private()));

        var result = await Service(factory).InviteAsync(User1, "event-1", Invite(NickName2, "FinnsInte"), TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.Code.Should().Be(EventErrorCodes.UnknownNickNames);
        result.Message.Details.Should().NotBeNull();
        result.Message.Details["nickNames"].Should().BeEquivalentTo(new[] { "FinnsInte" });
        (await InvitationsOf(factory)).Should().BeEmpty();
        _pushes.Should().BeEmpty();
    }

    [Fact]
    public async Task InviteAsync_SkipsParticipantsAndPendingInvitees_AndInvitesADeclinedOneAgain()
    {
        var earlier = DateTime.UtcNow.AddDays(-1);
        var factory = CreateSeededFactory(db =>
        {
            var e = Private();
            e.Participants.Add(new EventParticipant { UserId = 2 });
            e.ParticipantCount = 2;
            e.Invitations.Add(new EventInvitation { InvitedUserId = 3, InvitedByUserId = 1, CreatedAt = earlier });
            e.Invitations.Add(new EventInvitation { InvitedUserId = 4, InvitedByUserId = 3, Status = EventInvitationStatus.Declined, CreatedAt = earlier });
            db.Events.Add(e);
        });

        var result = await Service(factory).InviteAsync(User1, "event-1", Invite(NickName2, NickName3, NickName4), TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        var invitations = await InvitationsOf(factory);
        invitations.Keys.Should().BeEquivalentTo([3, 4]);
        invitations[3].CreatedAt.Should().Be(earlier);
        invitations[4].Status.Should().Be(EventInvitationStatus.Pending);
        invitations[4].InvitedByUserId.Should().Be(1);
        invitations[4].CreatedAt.Should().BeAfter(earlier);
        _pushes.Should().ContainSingle().Which.UserIds.Should().BeEquivalentTo([4]);
        (await InviteLogsOf(factory, 1)).Should().Be(1);
    }

    [Fact]
    public async Task InviteAsync_AnInviteeWhoBlockedTheInviter_GetsNothing_ButCountsTowardTheCap()
    {
        var factory = CreateSeededFactory(db =>
        {
            db.Events.Add(Private());
            db.UserBlocks.Add(new UserBlock { BlockerUserId = 2, BlockedUserId = 1 });
        });

        var result = await Service(factory).InviteAsync(User1, "event-1", Invite(NickName2, NickName3), TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        (await InvitationsOf(factory)).Keys.Should().BeEquivalentTo([3]);
        _pushes.Should().ContainSingle().Which.UserIds.Should().BeEquivalentTo([3]);
        (await InviteLogsOf(factory, 1)).Should().Be(2);
    }

    [Fact]
    public async Task InviteAsync_OverTheDailyCap_Is429AndSavesNothing()
    {
        var factory = CreateSeededFactory(db =>
        {
            db.Events.Add(Private());
            db.UserActionLogs.Add(new UserActionLog { UserId = 1, Action = UserAction.EventInvited, CreatedAt = DateTime.UtcNow.AddHours(-1) });
            db.UserActionLogs.Add(new UserActionLog { UserId = 1, Action = UserAction.EventInvited, CreatedAt = DateTime.UtcNow.AddDays(-2) });
        });

        var over = await Service(factory, invitedPerDay: 2).InviteAsync(User1, "event-1", Invite(NickName2, NickName3), TestContext.Current.CancellationToken);
        var within = await Service(factory, invitedPerDay: 2).InviteAsync(User1, "event-1", Invite(NickName2), TestContext.Current.CancellationToken);

        over.Message.Should().NotBeNull();
        over.Message.StatusCode.Should().Be(429);
        over.Message.Code.Should().Be(EventErrorCodes.TooManyInvites);
        within.Success.Should().BeTrue();
        (await InvitationsOf(factory)).Keys.Should().BeEquivalentTo([2]);
    }

    [Fact]
    public async Task InviteAsync_ToAFullEvent_Is409EventFull()
    {
        var full = Private();
        full.MaxParticipants = 2;
        full.Participants.Add(new EventParticipant { UserId = 4 });
        full.ParticipantCount = 2;
        var factory = CreateSeededFactory(db => db.Events.Add(full));

        var result = await Service(factory).InviteAsync(User1, "event-1", Invite(NickName2), TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(409);
        result.Message.Code.Should().Be(EventErrorCodes.EventFull);
    }

    [Theory]
    [InlineData(false, false)]
    [InlineData(true, true)]
    public async Task InviteAsync_ByAParticipant_OnlyWhenTheOrganizerAllowsIt(bool allowParticipantInvites, bool expected)
    {
        var e = Private();
        e.AllowParticipantInvites = allowParticipantInvites;
        e.Participants.Add(new EventParticipant { UserId = 2 });
        e.ParticipantCount = 2;
        var factory = CreateSeededFactory(db => db.Events.Add(e));

        var result = await Service(factory).InviteAsync(User2, "event-1", Invite(NickName3), TestContext.Current.CancellationToken);

        result.Success.Should().Be(expected);
        (await InvitationsOf(factory)).ContainsKey(3).Should().Be(expected);
    }

    [Fact]
    public async Task GetPendingAsync_ListsUpcomingPendingInvitations_InStartOrder_WithoutABlockedInvitersName()
    {
        var factory = CreateSeededFactory(db =>
        {
            var later = Private(1, startsInDays: 5);
            later.Invitations.Add(new EventInvitation { InvitedUserId = 2, InvitedByUserId = 1 });
            var sooner = Private(2, startsInDays: 2);
            sooner.Invitations.Add(new EventInvitation { InvitedUserId = 2, InvitedByUserId = 3 });
            var declined = Private(3);
            declined.Invitations.Add(new EventInvitation { InvitedUserId = 2, Status = EventInvitationStatus.Declined });
            var past = Private(4, startsInDays: -5);
            past.Invitations.Add(new EventInvitation { InvitedUserId = 2 });
            var hiddenOrganizer = Private(5, organizerId: 4);
            hiddenOrganizer.Invitations.Add(new EventInvitation { InvitedUserId = 2 });
            var someoneElse = Private(6);
            someoneElse.Invitations.Add(new EventInvitation { InvitedUserId = 3 });
            db.Events.AddRange(later, sooner, declined, past, hiddenOrganizer, someoneElse);
        });

        var result = await Service(factory, hiddenUserIds: [3, 4]).GetPendingAsync(User2, TestContext.Current.CancellationToken);

        result.Value.Should().NotBeNull();
        result.Value.Select(i => (i.Event.Identifier, i.InvitedByNickName)).Should().Equal(
            ("event-2", (string?)null),
            ("event-1", "NaturElskaren"));
    }

    [Fact]
    public async Task DeclineAsync_DeclinesOnce_AndIsQuietWhenNothingIsLeft()
    {
        var factory = CreateSeededFactory(db =>
        {
            var e = Private();
            e.Invitations.Add(new EventInvitation { InvitedUserId = 2, InvitedByUserId = 1 });
            db.Events.Add(e);
        });

        var first = await Service(factory).DeclineAsync(User2, "event-1", TestContext.Current.CancellationToken);
        var again = await Service(factory).DeclineAsync(User2, "event-1", TestContext.Current.CancellationToken);
        var gone = await Service(factory).DeclineAsync(User2, "no-such-event", TestContext.Current.CancellationToken);

        first.Success.Should().BeTrue();
        again.Success.Should().BeTrue();
        gone.Success.Should().BeTrue();
        (await InvitationsOf(factory))[2].Status.Should().Be(EventInvitationStatus.Declined);
    }

    [Theory]
    [InlineData(User1, true)]
    [InlineData(User3, true)]
    [InlineData(User2, false)]
    public async Task RevokeAsync_ByAHostOrTheInviter_ButNotAnotherParticipant(string caller, bool expected)
    {
        var factory = CreateSeededFactory(db =>
        {
            var e = Private();
            e.AllowParticipantInvites = true;
            e.Participants.Add(new EventParticipant { UserId = 2 });
            e.Participants.Add(new EventParticipant { UserId = 3 });
            e.ParticipantCount = 3;
            e.Invitations.Add(new EventInvitation { InvitedUserId = 4, InvitedByUserId = 3 });
            db.Events.Add(e);
        });
        const string Invitee = "c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f";
        using (var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken))
        {
            var invitee = await context.Users.SingleAsync(u => u.Id == 4, TestContext.Current.CancellationToken);
            invitee.Identifier = Invitee;
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var result = await Service(factory).RevokeAsync(caller, "event-1", Invitee, TestContext.Current.CancellationToken);

        result.Success.Should().Be(expected);
        if (!expected)
        {
            result.Message.Should().NotBeNull();
            result.Message.Code.Should().Be(EventErrorCodes.NotAllowed);
        }

        (await InvitationsOf(factory)).ContainsKey(4).Should().Be(!expected);
    }

    [Fact]
    public async Task RevokeAsync_OfAnInvitationThatIsGone_IsQuiet()
    {
        var factory = CreateSeededFactory(db => db.Events.Add(Private()));

        var result = await Service(factory).RevokeAsync(User1, "event-1", User2, TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
    }
}
