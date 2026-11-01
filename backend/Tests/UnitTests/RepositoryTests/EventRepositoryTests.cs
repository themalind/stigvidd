// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Interfaces.Repositories;
using Core.Repositories.Events;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace UnitTests.RepositoryTests;

public class EventRepositoryTests : TestBase
{
    private const double BorasLongitude = 12.94;
    private const double BorasLatitude = 57.72;
    private const string Trail2 = "22b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

    private static readonly DateTime Now = DateTime.UtcNow;

    internal static Event NewEvent(
        int id,
        int organizerId,
        EventVisibility visibility = EventVisibility.Open,
        EventStatus status = EventStatus.Published,
        int startsInDays = 3,
        double longitude = BorasLongitude,
        double latitude = BorasLatitude,
        ModerationState moderation = ModerationState.Visible)
    {
        var startsAt = Now.AddDays(startsInDays);

        return new Event
        {
            Id = id,
            Identifier = $"event-{id}",
            Title = $"Event {id}",
            Description = "Beskrivning",
            Location = GeoPointFactory.FromLonLat(longitude, latitude),
            StartsAt = startsAt,
            PastAfter = startsAt.AddDays(1),
            Visibility = visibility,
            Status = status,
            ModerationState = moderation,
            ParticipantCount = 1,
            Participants =
            [
                new EventParticipant { UserId = organizerId, Role = EventParticipantRole.Organizer, JoinedAt = Now.AddDays(-10) },
            ],
        };
    }

    private static EventRepository Repository(IDbContextFactory<StigViddDbContext> factory)
    {
        return new EventRepository(factory, NullLogger<EventRepository>.Instance);
    }

    private static EventFeedFilter Feed(
        int viewerId = 1,
        int[]? hidden = null,
        string? trail = null,
        string? organizer = null,
        EventArea? area = null,
        EventPageKey? after = null,
        int limit = 20)
    {
        return new EventFeedFilter(viewerId, hidden ?? [], Now, trail, organizer, area, after, limit);
    }

    private static async Task<IReadOnlyList<string>> FeedIdentifiers(IDbContextFactory<StigViddDbContext> factory, EventFeedFilter filter)
    {
        var result = await Repository(factory).GetFeedAsync(filter, TestContext.Current.CancellationToken);
        result.Value.Should().NotBeNull();
        return result.Value.Select(c => c.Identifier).ToList();
    }

    [Fact]
    public async Task CreateAsync_AddsTheOrganizerRowAndCountsThem()
    {
        var factory = CreateSeededFactory();
        var newEvent = NewEvent(0, organizerId: 0);
        newEvent.Participants.Clear();
        newEvent.ParticipantCount = 0;

        var result = await Repository(factory).CreateAsync(newEvent, 2, TimeSpan.FromDays(1), TestContext.Current.CancellationToken);

        result.IsSuccess.Should().BeTrue();
        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var stored = await context.Events.Include(e => e.Participants).SingleAsync(e => e.Identifier == result.Value, TestContext.Current.CancellationToken);
        stored.ParticipantCount.Should().Be(1);
        stored.Participants.Should().ContainSingle()
            .Which.Should().BeEquivalentTo(new { UserId = 2, Role = EventParticipantRole.Organizer, Status = EventParticipantStatus.Joined });
    }

    [Fact]
    public async Task CountUpcomingAsOrganizerAsync_SkipsPastCancelledAndCoHostedEvents()
    {
        var factory = CreateSeededFactory(db =>
        {
            db.Events.Add(NewEvent(1, organizerId: 1));
            db.Events.Add(NewEvent(2, organizerId: 1, startsInDays: -5));
            db.Events.Add(NewEvent(3, organizerId: 1, status: EventStatus.Cancelled));
            var cohosted = NewEvent(4, organizerId: 2);
            cohosted.Participants.Add(new EventParticipant { UserId = 1, Role = EventParticipantRole.CoHost });
            db.Events.Add(cohosted);
        });

        var result = await Repository(factory).CountUpcomingAsOrganizerAsync(1, Now, TestContext.Current.CancellationToken);

        result.Value.Should().Be(1);
    }

    private static Event Draft()
    {
        var draft = NewEvent(0, organizerId: 0);
        draft.Identifier = Guid.NewGuid().ToString();
        draft.Participants.Clear();
        return draft;
    }

    [Fact]
    public async Task CountCreatedSinceAsync_StillCountsEventsThatWereDeleted()
    {
        var factory = CreateSeededFactory();
        var repository = Repository(factory);
        var ctoken = TestContext.Current.CancellationToken;

        var first = await repository.CreateAsync(Draft(), organizerUserId: 1, TimeSpan.FromDays(1), ctoken);
        await repository.CreateAsync(Draft(), organizerUserId: 1, TimeSpan.FromDays(1), ctoken);
        first.Value.Should().NotBeNull();
        (await repository.DeleteAsync(first.Value, deletedByUserId: 1, DateTime.UtcNow, ctoken)).IsSuccess.Should().BeTrue();

        var result = await repository.CountCreatedSinceAsync(1, DateTime.UtcNow.AddDays(-1), ctoken);

        result.Value.Should().Be(2);
    }

    [Fact]
    public async Task CreateAsync_PrunesTheCreatorsLogRowsThatHaveLeftTheWindow()
    {
        var factory = CreateSeededFactory(db =>
        {
            db.UserActionLogs.Add(new UserActionLog { UserId = 1, Action = UserAction.EventCreated, CreatedAt = Now.AddDays(-2) });
            db.UserActionLogs.Add(new UserActionLog { UserId = 2, Action = UserAction.EventCreated, CreatedAt = Now.AddDays(-2) });
        });

        await Repository(factory).CreateAsync(Draft(), organizerUserId: 1, TimeSpan.FromDays(1), TestContext.Current.CancellationToken);

        using var db = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        (await db.UserActionLogs.Where(l => l.UserId == 1).Select(l => l.CreatedAt).ToListAsync(TestContext.Current.CancellationToken))
            .Should().ContainSingle().Which.Should().BeAfter(Now.AddDays(-1));
        (await db.UserActionLogs.CountAsync(l => l.UserId == 2, TestContext.Current.CancellationToken)).Should().Be(1);
    }

    [Fact]
    public async Task GetFeedAsync_ShowsOnlyOpenPublishedVisibleUpcomingEvents()
    {
        var factory = CreateSeededFactory(db =>
        {
            db.Events.Add(NewEvent(1, organizerId: 2));
            db.Events.Add(NewEvent(2, organizerId: 2, visibility: EventVisibility.Private));
            db.Events.Add(NewEvent(3, organizerId: 2, status: EventStatus.Cancelled));
            db.Events.Add(NewEvent(4, organizerId: 2, startsInDays: -5));
            db.Events.Add(NewEvent(5, organizerId: 2, moderation: ModerationState.HiddenPendingReview));
        });

        (await FeedIdentifiers(factory, Feed())).Should().Equal("event-1");
    }

    [Fact]
    public async Task GetFeedAsync_LeavesOutEventsWhoseOrganizerIsHidden()
    {
        var factory = CreateSeededFactory(db =>
        {
            db.Events.Add(NewEvent(1, organizerId: 2));
            db.Events.Add(NewEvent(2, organizerId: 3));
        });

        (await FeedIdentifiers(factory, Feed(hidden: [3]))).Should().Equal("event-1");
    }

    [Fact]
    public async Task GetFeedAsync_FiltersOnTrailAndOnOrganizerOrCoHost()
    {
        var factory = CreateSeededFactory(db =>
        {
            var onTrail = NewEvent(1, organizerId: 2);
            onTrail.TrailId = 2;
            db.Events.Add(onTrail);
            var cohosted = NewEvent(2, organizerId: 4);
            cohosted.Participants.Add(new EventParticipant { UserId = 3, Role = EventParticipantRole.CoHost });
            db.Events.Add(cohosted);
            var joinedOnly = NewEvent(3, organizerId: 4);
            joinedOnly.Participants.Add(new EventParticipant { UserId = 3, Role = EventParticipantRole.Participant });
            db.Events.Add(joinedOnly);
        });

        (await FeedIdentifiers(factory, Feed(trail: Trail2))).Should().Equal("event-1");
        (await FeedIdentifiers(factory, Feed(organizer: "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d67"))).Should().Equal("event-2");
    }

    [Fact]
    public async Task GetFeedAsync_WithAnArea_KeepsTheCircleNotTheBoxCorner()
    {
        // 0.12° east and 0.065° north of Borås: ~7.2 km and ~7.2 km, so ~10.2 km away, inside a 10 km box but outside the circle. keep-comment: why these offsets
        var factory = CreateSeededFactory(db =>
        {
            db.Events.Add(NewEvent(1, organizerId: 2));
            db.Events.Add(NewEvent(2, organizerId: 2, longitude: BorasLongitude + 0.12, latitude: BorasLatitude + 0.065));
            db.Events.Add(NewEvent(3, organizerId: 2, longitude: BorasLongitude + 0.05));
            db.Events.Add(NewEvent(4, organizerId: 2, longitude: 18.07, latitude: 59.33));
        });

        var area = new EventArea(BorasLongitude, BorasLatitude, 10_000);

        (await FeedIdentifiers(factory, Feed(area: area))).Should().BeEquivalentTo(["event-1", "event-3"]);
    }

    [Fact]
    public async Task GetFeedAsync_PagesByStartThenId()
    {
        var factory = CreateSeededFactory(db =>
        {
            db.Events.Add(NewEvent(1, organizerId: 2, startsInDays: 3));
            db.Events.Add(NewEvent(2, organizerId: 2, startsInDays: 1));
            var sameStart = NewEvent(3, organizerId: 2, startsInDays: 3);
            db.Events.Add(sameStart);
        });

        var first = await FeedIdentifiers(factory, Feed(limit: 2));
        first.Should().Equal("event-2", "event-1");

        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var last = await context.Events.SingleAsync(e => e.Id == 1, TestContext.Current.CancellationToken);

        (await FeedIdentifiers(factory, Feed(after: new EventPageKey(last.StartsAt, last.Id)))).Should().Equal("event-3");
    }

    [Fact]
    public async Task GetMineAsync_SplitsUpcomingAndPastAndSkipsRemovedRows()
    {
        var factory = CreateSeededFactory(db =>
        {
            db.Events.Add(NewEvent(1, organizerId: 1, visibility: EventVisibility.Private));
            var interested = NewEvent(2, organizerId: 2);
            interested.Participants.Add(new EventParticipant { UserId = 1, Status = EventParticipantStatus.Interested });
            db.Events.Add(interested);
            var removed = NewEvent(3, organizerId: 2);
            removed.Participants.Add(new EventParticipant { UserId = 1, Status = EventParticipantStatus.Removed });
            db.Events.Add(removed);
            db.Events.Add(NewEvent(4, organizerId: 1, startsInDays: -10));
            db.Events.Add(NewEvent(5, organizerId: 1, startsInDays: -20));
        });

        var upcoming = await Repository(factory).GetMineAsync(new EventMineFilter(1, [], Now, false, null, 20), TestContext.Current.CancellationToken);
        var past = await Repository(factory).GetMineAsync(new EventMineFilter(1, [], Now, true, null, 20), TestContext.Current.CancellationToken);

        upcoming.Value.Should().NotBeNull();
        upcoming.Value.Select(c => c.Identifier).Should().BeEquivalentTo(["event-1", "event-2"]);
        upcoming.Value.Single(c => c.Identifier == "event-2").MyStatus.Should().Be(EventParticipantStatus.Interested);
        past.Value.Should().NotBeNull();
        past.Value.Select(c => c.Identifier).Should().Equal("event-4", "event-5");
    }

    [Fact]
    public async Task GetMineAsync_CountsUnreadPostsFromOthersAfterTheReadMarker()
    {
        var factory = CreateSeededFactory(db =>
        {
            var e = NewEvent(1, organizerId: 2);
            e.Participants.Add(new EventParticipant { UserId = 1, LastReadPostAt = Now.AddHours(-2) });
            e.Posts.Add(new EventPost { UserId = 2, Body = "read", CreatedAt = Now.AddHours(-3) });
            e.Posts.Add(new EventPost { UserId = 2, Body = "new", CreatedAt = Now.AddHours(-1) });
            e.Posts.Add(new EventPost { UserId = 1, Body = "mine", CreatedAt = Now.AddHours(-1) });
            e.Posts.Add(new EventPost { UserId = 3, Body = "hidden author", CreatedAt = Now.AddHours(-1) });
            e.Posts.Add(new EventPost { UserId = 2, Body = "moderated", CreatedAt = Now.AddHours(-1), ModerationState = ModerationState.HiddenPendingReview });
            db.Events.Add(e);
        });

        var result = await Repository(factory).GetMineAsync(new EventMineFilter(1, [3], Now, false, null, 20), TestContext.Current.CancellationToken);

        result.Value.Should().NotBeNull();
        result.Value.Should().ContainSingle().Which.UnreadPostCount.Should().Be(1);
    }

    [Fact]
    public async Task GetDetailAsync_LoadsTheViewersRelation()
    {
        var factory = CreateSeededFactory(db =>
        {
            var e = NewEvent(1, organizerId: 2, visibility: EventVisibility.Private);
            e.Participants.Add(new EventParticipant { UserId = 3, Status = EventParticipantStatus.Interested });
            e.Invitations.Add(new EventInvitation { InvitedUserId = 1 });
            db.Events.Add(e);
        });

        var result = await Repository(factory).GetDetailAsync("event-1", 1, TestContext.Current.CancellationToken);

        result.Value.Should().NotBeNull();
        result.Value.Should().BeEquivalentTo(new
        {
            OrganizerUserId = 2,
            OrganizerNickName = "VandrarVennen",
            InterestedCount = 1,
            MyRole = (EventParticipantRole?)null,
            HasPendingInvite = true,
        }, o => o.ExcludingMissingMembers());
    }

    [Fact]
    public async Task CancelAsync_DeletesInvitationsAndNamesJoinedAndInterestedButNotTheCanceller()
    {
        var factory = CreateSeededFactory(db =>
        {
            var e = NewEvent(1, organizerId: 1);
            e.Participants.Add(new EventParticipant { UserId = 2 });
            e.Participants.Add(new EventParticipant { UserId = 3, Status = EventParticipantStatus.Interested });
            e.Participants.Add(new EventParticipant { UserId = 4, Status = EventParticipantStatus.Removed });
            e.Invitations.Add(new EventInvitation { InvitedUserId = 5 });
            e.Invitations.Add(new EventInvitation { InvitedUserId = 6, Status = EventInvitationStatus.Declined });
            db.Events.Add(e);
        });

        var result = await Repository(factory).CancelAsync("event-1", 1, Now, TestContext.Current.CancellationToken);

        result.Value.Should().NotBeNull();
        result.Value.NotifyUserIds.Should().BeEquivalentTo([2, 3]);
        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        (await context.EventInvitations.CountAsync(TestContext.Current.CancellationToken)).Should().Be(0);
        (await context.Events.SingleAsync(TestContext.Current.CancellationToken)).Status.Should().Be(EventStatus.Cancelled);
    }

    [Fact]
    public async Task CancelAsync_WhenAlreadyCancelled_IsAConflict()
    {
        var factory = CreateSeededFactory(db => db.Events.Add(NewEvent(1, organizerId: 1, status: EventStatus.Cancelled)));

        var result = await Repository(factory).CancelAsync("event-1", 1, Now, TestContext.Current.CancellationToken);

        result.Status.Should().Be(RepositoryResultStatus.Conflict);
    }

    [Fact]
    public async Task UpdateAsync_OfAnEventCancelledSinceTheServiceChecked_IsAConflictAndSavesNothing()
    {
        var factory = CreateSeededFactory(db => db.Events.Add(NewEvent(1, organizerId: 1, status: EventStatus.Cancelled)));

        var result = await Repository(factory).UpdateAsync("event-1", 1, e => e.Title = "Ny titel", TestContext.Current.CancellationToken);

        result.Status.Should().Be(RepositoryResultStatus.Conflict);
        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        (await context.Events.SingleAsync(TestContext.Current.CancellationToken)).Title.Should().Be("Event 1");
    }

    [Fact]
    public async Task UpdateAsync_LoweringMaxBelowACountThatGrewSinceTheServiceChecked_IsAConflictAndSavesNothing()
    {
        var factory = CreateSeededFactory(db =>
        {
            var e = NewEvent(1, organizerId: 1);
            e.ParticipantCount = 3;
            db.Events.Add(e);
        });

        var result = await Repository(factory).UpdateAsync("event-1", 1, e => e.MaxParticipants = 2, TestContext.Current.CancellationToken);

        result.Status.Should().Be(RepositoryResultStatus.Conflict);
        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        (await context.Events.SingleAsync(TestContext.Current.CancellationToken)).MaxParticipants.Should().BeNull();
    }

    [Fact]
    public async Task UpdateAsync_NamesJoinedAndInterestedButNotTheEditorOrTheRemoved()
    {
        var factory = CreateSeededFactory(db =>
        {
            var e = NewEvent(1, organizerId: 1);
            e.Participants.Add(new EventParticipant { UserId = 2, Role = EventParticipantRole.CoHost });
            e.Participants.Add(new EventParticipant { UserId = 3, Status = EventParticipantStatus.Interested });
            e.Participants.Add(new EventParticipant { UserId = 4, Status = EventParticipantStatus.Removed });
            db.Events.Add(e);
        });

        var result = await Repository(factory).UpdateAsync("event-1", 2, e => e.Title = "Ny titel", TestContext.Current.CancellationToken);

        result.Value.Should().NotBeNull();
        result.Value.NotifyUserIds.Should().BeEquivalentTo([1, 3]);
    }

    [Fact]
    public async Task DeleteAsync_RemovesEveryChildRowAndReturnsTheImage()
    {
        var factory = CreateSeededFactory(db =>
        {
            var e = NewEvent(1, organizerId: 1);
            e.Participants.Add(new EventParticipant { UserId = 2 });
            e.Invitations.Add(new EventInvitation { InvitedUserId = 3 });
            e.Posts.Add(new EventPost { UserId = 2, Body = "hidden", ModerationState = ModerationState.HiddenPendingReview });
            e.Image = new EventImage { ImageUrl = "events/a.jpeg" };
            db.Events.Add(e);
        });

        var result = await Repository(factory).DeleteAsync("event-1", 1, Now, TestContext.Current.CancellationToken);

        result.Value.Should().NotBeNull();
        result.Value.ImageUrl.Should().Be("events/a.jpeg");
        result.Value.NotifyUserIds.Should().Equal(2);
        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        (await context.Events.CountAsync(TestContext.Current.CancellationToken)).Should().Be(0);
        (await context.EventParticipants.CountAsync(TestContext.Current.CancellationToken)).Should().Be(0);
        (await context.EventInvitations.CountAsync(TestContext.Current.CancellationToken)).Should().Be(0);
        (await context.EventPosts.IgnoreQueryFilters().CountAsync(TestContext.Current.CancellationToken)).Should().Be(0);
        (await context.EventImages.CountAsync(TestContext.Current.CancellationToken)).Should().Be(0);
    }

    [Fact]
    public async Task DeleteAsync_OfAPastEvent_NotifiesNobody()
    {
        var factory = CreateSeededFactory(db =>
        {
            var e = NewEvent(1, organizerId: 1, startsInDays: -5);
            e.Participants.Add(new EventParticipant { UserId = 2 });
            db.Events.Add(e);
        });

        var result = await Repository(factory).DeleteAsync("event-1", 1, Now, TestContext.Current.CancellationToken);

        result.Value.Should().NotBeNull();
        result.Value.NotifyUserIds.Should().BeEmpty();
    }
}
