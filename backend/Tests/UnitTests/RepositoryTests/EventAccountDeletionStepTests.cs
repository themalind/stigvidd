// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Interfaces.Repositories;
using Core.Repositories.Events;
using Core.Services.Push;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;

namespace UnitTests.RepositoryTests;

public class EventAccountDeletionStepTests : TestBase
{
    private static async Task<AccountDeletionEffects> RunAsync(IDbContextFactory<StigViddDbContext> factory, int userId)
    {
        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        return await new EventAccountDeletionStep().RunAsync(context, userId, TestContext.Current.CancellationToken);
    }

    private static async Task<Event> LoadAsync(IDbContextFactory<StigViddDbContext> factory, int eventId)
    {
        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        return await context.Events
            .Include(e => e.Participants)
            .Include(e => e.Invitations)
            .SingleAsync(e => e.Id == eventId, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task RunAsync_OrganizerWithCoHosts_PromotesTheEarliestJoinedCoHost()
    {
        var factory = CreateSeededFactory(db =>
        {
            var e = EventRepositoryTests.NewEvent(1, organizerId: 1);
            e.Participants.Add(new EventParticipant { UserId = 2, Role = EventParticipantRole.CoHost, JoinedAt = DateTime.UtcNow.AddDays(-1) });
            e.Participants.Add(new EventParticipant { UserId = 3, Role = EventParticipantRole.CoHost, JoinedAt = DateTime.UtcNow.AddDays(-2) });
            e.Participants.Add(new EventParticipant { UserId = 4, Role = EventParticipantRole.CoHost, Status = EventParticipantStatus.Removed, JoinedAt = DateTime.UtcNow.AddDays(-3) });
            e.ParticipantCount = 3;
            db.Events.Add(e);
        });

        var effects = await RunAsync(factory, 1);

        var stored = await LoadAsync(factory, 1);
        stored.Status.Should().Be(EventStatus.Published);
        stored.Participants.Single(p => p.Role == EventParticipantRole.Organizer).UserId.Should().Be(3);
        stored.ParticipantCount.Should().Be(stored.Participants.Count(p => p.Status == EventParticipantStatus.Joined));
        effects.Pushes.Should().ContainSingle().Which.Should().BeEquivalentTo(new { UserIds = new[] { 3 } }, o => o.ExcludingMissingMembers());
        effects.Pushes[0].Data["type"].Should().Be(PushTypes.EventPromoted);
    }

    [Theory]
    [InlineData(false, 3)]
    [InlineData(true, 2)]
    public async Task RunAsync_SkipsABannedCoHost_ButNotOneWhoseBanWasLifted(bool lifted, int expectedOrganizer)
    {
        var factory = CreateSeededFactory(db =>
        {
            var e = EventRepositoryTests.NewEvent(1, organizerId: 1);
            e.Participants.Add(new EventParticipant { UserId = 2, Role = EventParticipantRole.CoHost, JoinedAt = DateTime.UtcNow.AddDays(-2) });
            e.Participants.Add(new EventParticipant { UserId = 3, Role = EventParticipantRole.CoHost, JoinedAt = DateTime.UtcNow.AddDays(-1) });
            e.ParticipantCount = 3;
            db.Events.Add(e);
            db.UserBans.Add(new UserBan { UserId = 2, BannedBy = "moderator", LiftedAt = lifted ? DateTime.UtcNow.AddHours(-1) : null });
        });

        await RunAsync(factory, 1);

        var stored = await LoadAsync(factory, 1);
        stored.Status.Should().Be(EventStatus.Published);
        stored.Participants.Single(p => p.Role == EventParticipantRole.Organizer).UserId.Should().Be(expectedOrganizer);
    }

    [Fact]
    public async Task RunAsync_OnlyABannedCoHost_CancelsLikeHavingNone()
    {
        var factory = CreateSeededFactory(db =>
        {
            var e = EventRepositoryTests.NewEvent(1, organizerId: 1);
            e.Participants.Add(new EventParticipant { UserId = 2, Role = EventParticipantRole.CoHost });
            e.ParticipantCount = 2;
            db.Events.Add(e);
            db.UserBans.Add(new UserBan { UserId = 2, BannedBy = "moderator" });
        });

        var effects = await RunAsync(factory, 1);

        var stored = await LoadAsync(factory, 1);
        stored.Status.Should().Be(EventStatus.Cancelled);
        stored.Participants.Should().NotContain(p => p.Role == EventParticipantRole.Organizer);
        stored.ParticipantCount.Should().Be(1);
        effects.Pushes.Should().ContainSingle().Which.UserIds.Should().Equal(2);
    }

    [Fact]
    public async Task RunAsync_OrganizerWithoutCoHost_CancelsAndTellsJoinedAndInterested()
    {
        var factory = CreateSeededFactory(db =>
        {
            var e = EventRepositoryTests.NewEvent(1, organizerId: 1);
            e.Participants.Add(new EventParticipant { UserId = 2 });
            e.Participants.Add(new EventParticipant { UserId = 3, Status = EventParticipantStatus.Interested });
            e.Invitations.Add(new EventInvitation { InvitedUserId = 4 });
            e.ParticipantCount = 2;
            db.Events.Add(e);
        });

        var effects = await RunAsync(factory, 1);

        var stored = await LoadAsync(factory, 1);
        stored.Status.Should().Be(EventStatus.Cancelled);
        stored.Invitations.Should().BeEmpty();
        stored.Participants.Should().NotContain(p => p.Role == EventParticipantRole.Organizer);
        stored.ParticipantCount.Should().Be(1);
        effects.Pushes.Should().ContainSingle();
        effects.Pushes[0].UserIds.Should().BeEquivalentTo([2, 3]);
        effects.Pushes[0].FromUserId.Should().BeNull();
        effects.Pushes[0].Data["type"].Should().Be(PushTypes.EventCancelled);
    }

    [Theory]
    [InlineData(-10, EventStatus.Published)]
    [InlineData(3, EventStatus.Cancelled)]
    public async Task RunAsync_PastOrCancelledEventWithACoHost_PromotesThemWithoutAPush(int startsInDays, EventStatus status)
    {
        var factory = CreateSeededFactory(db =>
        {
            var e = EventRepositoryTests.NewEvent(1, organizerId: 1, status: status, startsInDays: startsInDays);
            e.Participants.Add(new EventParticipant { UserId = 2, Role = EventParticipantRole.CoHost });
            e.ParticipantCount = 2;
            db.Events.Add(e);
        });

        var effects = await RunAsync(factory, 1);

        var stored = await LoadAsync(factory, 1);
        stored.Participants.Single(p => p.Role == EventParticipantRole.Organizer).UserId.Should().Be(2);
        effects.Pushes.Should().BeEmpty();
    }

    [Fact]
    public async Task RunAsync_OrganizerOfAPastEvent_LeavesItAsItWas()
    {
        var factory = CreateSeededFactory(db => db.Events.Add(EventRepositoryTests.NewEvent(1, organizerId: 1, startsInDays: -10)));

        var effects = await RunAsync(factory, 1);

        (await LoadAsync(factory, 1)).Status.Should().Be(EventStatus.Published);
        effects.Pushes.Should().BeEmpty();
    }

    [Fact]
    public async Task RunAsync_Participant_IsRemovedEverywhereAndTheCountFollows()
    {
        var factory = CreateSeededFactory(db =>
        {
            var e = EventRepositoryTests.NewEvent(1, organizerId: 2);
            e.Participants.Add(new EventParticipant { UserId = 1 });
            e.Invitations.Add(new EventInvitation { InvitedUserId = 3, InvitedByUserId = 1 });
            e.Posts.Add(new EventPost { UserId = 1, Body = "hej", ModerationState = ModerationState.HiddenPendingReview });
            e.ParticipantCount = 2;
            db.Events.Add(e);
            var invitedTo = EventRepositoryTests.NewEvent(2, organizerId: 2, visibility: EventVisibility.Private);
            invitedTo.Invitations.Add(new EventInvitation { InvitedUserId = 1 });
            db.Events.Add(invitedTo);
        });

        var effects = await RunAsync(factory, 1);

        var stored = await LoadAsync(factory, 1);
        stored.Participants.Should().NotContain(p => p.UserId == 1);
        stored.ParticipantCount.Should().Be(1);
        stored.Invitations.Should().ContainSingle().Which.InvitedByUserId.Should().BeNull();
        (await LoadAsync(factory, 2)).Invitations.Should().BeEmpty();
        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        (await context.EventPosts.IgnoreQueryFilters().AnyAsync(TestContext.Current.CancellationToken)).Should().BeFalse();
        effects.Pushes.Should().BeEmpty();
    }

    [Fact]
    public async Task DeleteAccountAsync_RunsTheStepAndHandsThePushesBack()
    {
        var factory = CreateSeededFactory(db =>
        {
            var e = EventRepositoryTests.NewEvent(1, organizerId: 1);
            e.Participants.Add(new EventParticipant { UserId = 2 });
            e.ParticipantCount = 2;
            db.Events.Add(e);
        });

        var result = await DeleteAccountAsync(factory, Utilities.Identifiers.User);

        result.Value.Should().NotBeNull();
        result.Value.Pushes.Should().ContainSingle().Which.UserIds.Should().Equal(2);
        (await LoadAsync(factory, 1)).Status.Should().Be(EventStatus.Cancelled);
    }
}
