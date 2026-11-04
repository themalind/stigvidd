// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Factories;
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
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using UnitTests.RepositoryTests;
using WebDataContracts.RequestModels.Event;

namespace UnitTests.ServiceTests;

public class EventServiceTests : TestBase
{
    private const string User1 = Utilities.Identifiers.User;
    private const string User3 = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d67";
    private const string Trail2 = "22b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

    private readonly Mock<IPushQueue> _pushQueue = new();
    private readonly Mock<IWebDavService> _webDav = Utilities.MockFactory.WebDavService();

    private EventService Service(IDbContextFactory<StigViddDbContext> factory, params int[] hiddenUserIds)
    {
        return ServiceWith(factory, new EventRepository(factory, NullLogger<EventRepository>.Instance), hiddenUserIds);
    }

    private EventService ServiceWith(IDbContextFactory<StigViddDbContext> factory, IEventRepository repository, params int[] hiddenUserIds)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["PresentableBaseUrl"] = Utilities.Stubs.PresentableBaseUrl,
            })
            .Build();

        return new EventService(
            repository,
            new EventLoader(
                new EventRepository(factory, NullLogger<EventRepository>.Instance),
                new UserRepository(factory, NullLogger<UserRepository>.Instance),
                Utilities.MockFactory.UserBlockServiceHiding(hiddenUserIds).Object),
            Utilities.MockFactory.UserBlockServiceHiding(hiddenUserIds).Object,
            _pushQueue.Object,
            _webDav.Object,
            new EventResponseFactory(configuration),
            Options.Create(new EventLimits { UpcomingAsOrganizer = 2, CreatedPerDay = 3 }),
            NullLogger<EventService>.Instance);
    }

    private static CreateEventRequest Create(string? trail = null)
    {
        return new CreateEventRequest
        {
            Title = "  Kvällsvandring ",
            Description = "Runt sjön",
            Visibility = "Open",
            TrailIdentifier = trail,
            MeetingPointLongitude = trail is null ? 12.94m : null,
            MeetingPointLatitude = trail is null ? 57.72m : null,
            StartsAt = DateTime.UtcNow.AddDays(3),
        };
    }

    private static UpdateEventRequest UpdateOf(Event e)
    {
        return new UpdateEventRequest
        {
            Title = "Ny titel",
            Description = e.Description,
            MeetingPointLongitude = 12.94m,
            MeetingPointLatitude = 57.72m,
            StartsAt = e.StartsAt,
            MaxParticipants = e.MaxParticipants,
        };
    }

    private static Event Joined(Event e, int userId, EventParticipantRole role = EventParticipantRole.Participant)
    {
        e.Participants.Add(new EventParticipant { UserId = userId, Role = role });
        e.ParticipantCount = e.Participants.Count(p => p.Status == EventParticipantStatus.Joined);
        return e;
    }

    [Fact]
    public async Task CreateAsync_MakesTheCallerOrganizerAndTrimsText()
    {
        var factory = CreateSeededFactory();

        var result = await Service(factory).CreateAsync(User1, Create(), TestContext.Current.CancellationToken);

        result.Value.Should().NotBeNull();
        result.Value.Title.Should().Be("Kvällsvandring");
        result.Value.MyRole.Should().Be("Organizer");
        result.Value.ParticipantCount.Should().Be(1);
        result.Value.Permissions.CanCancel.Should().BeTrue();
    }

    [Fact]
    public async Task CreateAsync_WithOnlyATrail_PlacesTheEventAtTheTrailStart()
    {
        var factory = CreateSeededFactory();

        var result = await Service(factory).CreateAsync(User1, Create(trail: Trail2), TestContext.Current.CancellationToken);

        result.Value.Should().NotBeNull();
        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var stored = await context.Events.SingleAsync(TestContext.Current.CancellationToken);
        stored.TrailId.Should().Be(2);
        stored.MeetingPoint.Should().BeNull();
        stored.Location.X.Should().Be(12.80);
        stored.Location.Y.Should().Be(57.62);
        stored.Location.SRID.Should().Be(4326);
        stored.PastAfter.Should().Be(stored.StartsAt.AddDays(1));
    }

    [Fact]
    public async Task CreateAsync_StoresEveryTimeAsUtc_WhateverKindTheJsonGave()
    {
        var factory = CreateSeededFactory();
        var startsAt = DateTime.UtcNow.AddDays(3);
        var request = Create();
        request.StartsAt = DateTime.SpecifyKind(startsAt, DateTimeKind.Unspecified);
        request.EndsAt = startsAt.AddHours(3).ToLocalTime();
        request.RegistrationDeadline = DateTime.SpecifyKind(startsAt.AddDays(-1), DateTimeKind.Unspecified);

        var result = await Service(factory).CreateAsync(User1, request, TestContext.Current.CancellationToken);

        result.Value.Should().NotBeNull();
        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var stored = await context.Events.SingleAsync(TestContext.Current.CancellationToken);
        stored.StartsAt.Kind.Should().Be(DateTimeKind.Utc);
        stored.StartsAt.Should().Be(startsAt);
        stored.EndsAt.Should().NotBeNull();
        stored.EndsAt.Value.Kind.Should().Be(DateTimeKind.Utc);
        stored.EndsAt.Value.Should().Be(startsAt.AddHours(3));
        stored.PastAfter.Kind.Should().Be(DateTimeKind.Utc);
        stored.RegistrationDeadline.Should().NotBeNull();
        stored.RegistrationDeadline.Value.Kind.Should().Be(DateTimeKind.Utc);
    }

    [Fact]
    public async Task CreateAsync_WithAnUnknownTrail_Is400()
    {
        var result = await Service(CreateSeededFactory()).CreateAsync(User1, Create(trail: "no-such-trail"), TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task CreateAsync_OverTheUpcomingQuota_Is429WithItsCode()
    {
        var factory = CreateSeededFactory(db =>
        {
            db.Events.Add(EventRepositoryTests.NewEvent(1, organizerId: 1));
            db.Events.Add(EventRepositoryTests.NewEvent(2, organizerId: 1));
        });

        var result = await Service(factory).CreateAsync(User1, Create(), TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(429);
        result.Message.Code.Should().Be(EventErrorCodes.TooManyUpcoming);
    }

    [Fact]
    public async Task CreateAsync_OverTheDailyQuotaEvenAfterDeleting_Is429WithItsCode()
    {
        var service = Service(CreateSeededFactory());
        var ctoken = TestContext.Current.CancellationToken;

        for (var i = 0; i < 3; i++)
        {
            var created = await service.CreateAsync(User1, Create(), ctoken);
            created.Value.Should().NotBeNull();
            (await service.DeleteAsync(User1, created.Value.Identifier, ctoken)).Success.Should().BeTrue();
        }

        var result = await service.CreateAsync(User1, Create(), ctoken);

        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(429);
        result.Message.Code.Should().Be(EventErrorCodes.TooManyToday);
    }

    [Fact]
    public async Task GetAsync_TellsAnOutsiderTheyMayMarkInterestedButNotAJoinedParticipant()
    {
        var factory = CreateSeededFactory(db =>
        {
            db.Events.Add(EventRepositoryTests.NewEvent(1, organizerId: 2));
            db.Events.Add(Joined(EventRepositoryTests.NewEvent(2, organizerId: 2), 1));
        });

        var outsider = await Service(factory).GetAsync(User1, "event-1", TestContext.Current.CancellationToken);
        var joined = await Service(factory).GetAsync(User1, "event-2", TestContext.Current.CancellationToken);

        outsider.Value.Should().NotBeNull();
        outsider.Value.Permissions.CanMarkInterested.Should().BeTrue();
        joined.Value.Should().NotBeNull();
        joined.Value.Permissions.CanMarkInterested.Should().BeFalse();
    }

    [Fact]
    public async Task GetAsync_PrivateEventForAnOutsider_Is404EventGone()
    {
        var factory = CreateSeededFactory(db => db.Events.Add(EventRepositoryTests.NewEvent(1, organizerId: 2, visibility: EventVisibility.Private)));

        var result = await Service(factory).GetAsync(User1, "event-1", TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.Code.Should().Be(EventErrorCodes.EventGone);
    }

    [Fact]
    public async Task GetAsync_PrivateEventWithABlockedOrganizer_StaysEventGoneForAnOutsider()
    {
        var factory = CreateSeededFactory(db => db.Events.Add(EventRepositoryTests.NewEvent(1, organizerId: 2, visibility: EventVisibility.Private)));

        var result = await Service(factory, 2).GetAsync(User1, "event-1", TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.Code.Should().Be(EventErrorCodes.EventGone);
    }

    [Fact]
    public async Task GetAsync_OpenEventWithAHiddenOrganizer_Is404ForAnOutsiderOnly()
    {
        var factory = CreateSeededFactory(db =>
        {
            db.Events.Add(EventRepositoryTests.NewEvent(1, organizerId: 2));
            db.Events.Add(Joined(EventRepositoryTests.NewEvent(2, organizerId: 2), 1));
        });

        var outsider = await Service(factory, 2).GetAsync(User1, "event-1", TestContext.Current.CancellationToken);
        var inside = await Service(factory, 2).GetAsync(User1, "event-2", TestContext.Current.CancellationToken);

        outsider.Message.Should().NotBeNull();
        outsider.Message.StatusCode.Should().Be(404);
        outsider.Message.Code.Should().Be(EventErrorCodes.OrganizerBlocked);
        inside.Value.Should().NotBeNull();
        inside.Value.OrganizerNickName.Should().BeNull();
    }

    [Fact]
    public async Task UpdateAsync_ByAParticipant_Is403NotAllowed()
    {
        var factory = CreateSeededFactory(db => db.Events.Add(Joined(EventRepositoryTests.NewEvent(1, organizerId: 2), 1)));

        var result = await Service(factory).UpdateAsync(User1, "event-1", UpdateOf(EventRepositoryTests.NewEvent(1, 2)), TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(403);
        result.Message.Code.Should().Be(EventErrorCodes.NotAllowed);
    }

    [Fact]
    public async Task UpdateAsync_OfAPastEvent_Is409EventPast_SoItCannotBeRevived()
    {
        var past = EventRepositoryTests.NewEvent(1, organizerId: 1, startsInDays: -3);
        var factory = CreateSeededFactory(db => db.Events.Add(past));
        var revived = UpdateOf(past);
        revived.StartsAt = DateTime.UtcNow.AddDays(5);

        var result = await Service(factory).UpdateAsync(User1, "event-1", revived, TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(409);
        result.Message.Code.Should().Be(EventErrorCodes.EventPast);
    }

    [Fact]
    public async Task UpdateAsync_OfAReportedEvent_Is403_SoTheAdminJudgesTheReportedText()
    {
        var reported = EventRepositoryTests.NewEvent(1, organizerId: 1);
        reported.ModerationState = ModerationState.HiddenPendingReview;
        var factory = CreateSeededFactory(db => db.Events.Add(reported));

        var result = await Service(factory).UpdateAsync(User1, "event-1", UpdateOf(reported), TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(403);
        result.Message.Code.Should().Be(EventErrorCodes.NotAllowed);
    }

    [Fact]
    public async Task UpdateAsync_RefusesAMovedDeadlineInThePast_ButKeepsAnUnchangedOne()
    {
        var closed = EventRepositoryTests.NewEvent(1, organizerId: 1);
        closed.RegistrationDeadline = DateTime.UtcNow.AddHours(-2);
        var factory = CreateSeededFactory(db => db.Events.Add(closed));

        var same = UpdateOf(closed);
        same.RegistrationDeadline = closed.RegistrationDeadline;
        var unchanged = await Service(factory).UpdateAsync(User1, "event-1", same, TestContext.Current.CancellationToken);

        var moved = UpdateOf(closed);
        moved.RegistrationDeadline = DateTime.UtcNow.AddHours(-1);
        var movedResult = await Service(factory).UpdateAsync(User1, "event-1", moved, TestContext.Current.CancellationToken);

        unchanged.Value.Should().NotBeNull();
        movedResult.Message.Should().NotBeNull();
        movedResult.Message.StatusCode.Should().Be(400);
    }

    private static Event Ongoing(DateTime? endsAt = null)
    {
        var e = EventRepositoryTests.NewEvent(1, organizerId: 1);
        e.StartsAt = DateTime.UtcNow.AddHours(-2);
        e.EndsAt = endsAt;
        e.PastAfter = endsAt ?? e.StartsAt.AddDays(1);
        e.RegistrationDeadline = DateTime.UtcNow.AddHours(-3);
        return e;
    }

    [Fact]
    public async Task UpdateAsync_OfAnOngoingEvent_TakesTimesOffBySecondsAsUnchanged_ButRefusesARealMove()
    {
        var ongoing = Ongoing();
        var factory = CreateSeededFactory(db => db.Events.Add(ongoing));

        var rebuilt = UpdateOf(ongoing);
        rebuilt.StartsAt = ongoing.StartsAt.AddSeconds(-30);
        rebuilt.RegistrationDeadline = ongoing.RegistrationDeadline?.AddSeconds(-20);
        var rebuiltResult = await Service(factory).UpdateAsync(User1, "event-1", rebuilt, TestContext.Current.CancellationToken);

        var moved = UpdateOf(ongoing);
        moved.StartsAt = ongoing.StartsAt.AddMinutes(-5);
        moved.RegistrationDeadline = ongoing.RegistrationDeadline;
        var movedResult = await Service(factory).UpdateAsync(User1, "event-1", moved, TestContext.Current.CancellationToken);

        rebuiltResult.Value.Should().NotBeNull();
        movedResult.Message.Should().NotBeNull();
        movedResult.Message.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task UpdateAsync_RefusesAnEditThatWouldEndTheEventInThePast()
    {
        var ongoing = Ongoing(endsAt: DateTime.UtcNow.AddDays(1));
        ongoing.StartsAt = DateTime.UtcNow.AddDays(-2);
        ongoing.RegistrationDeadline = null;
        var factory = CreateSeededFactory(db => db.Events.Add(ongoing));

        var endedEarly = UpdateOf(ongoing);
        endedEarly.EndsAt = DateTime.UtcNow.AddMinutes(-1);
        var cleared = UpdateOf(ongoing);
        cleared.EndsAt = null;
        var extended = UpdateOf(ongoing);
        extended.EndsAt = DateTime.UtcNow.AddDays(2);

        var endedEarlyResult = await Service(factory).UpdateAsync(User1, "event-1", endedEarly, TestContext.Current.CancellationToken);
        var clearedResult = await Service(factory).UpdateAsync(User1, "event-1", cleared, TestContext.Current.CancellationToken);
        var extendedResult = await Service(factory).UpdateAsync(User1, "event-1", extended, TestContext.Current.CancellationToken);

        endedEarlyResult.Message.Should().NotBeNull();
        endedEarlyResult.Message.StatusCode.Should().Be(400);
        clearedResult.Message.Should().NotBeNull();
        clearedResult.Message.StatusCode.Should().Be(400);
        extendedResult.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task UpdateAsync_OfAnEventWhoseTrailWasDeleted_KeepsItsLocation_ButAnEventWithAPlaceStillNeedsOne()
    {
        var trailGone = EventRepositoryTests.NewEvent(1, organizerId: 1);
        var withMeetingPoint = EventRepositoryTests.NewEvent(2, organizerId: 1);
        withMeetingPoint.MeetingPoint = GeoPointFactory.FromLonLat(12.5, 57.5);
        var factory = CreateSeededFactory(db =>
        {
            db.Events.Add(trailGone);
            db.Events.Add(withMeetingPoint);
        });

        var kept = await Service(factory).UpdateAsync(User1, "event-1", WithoutPlace(UpdateOf(trailGone)), TestContext.Current.CancellationToken);
        var refused = await Service(factory).UpdateAsync(User1, "event-2", WithoutPlace(UpdateOf(withMeetingPoint)), TestContext.Current.CancellationToken);

        kept.Value.Should().NotBeNull();
        kept.Value.Title.Should().Be("Ny titel");
        refused.Message.Should().NotBeNull();
        refused.Message.StatusCode.Should().Be(400);
        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var stored = await context.Events.SingleAsync(e => e.Id == 1, TestContext.Current.CancellationToken);
        stored.Location.X.Should().Be(12.94);
        stored.Location.Y.Should().Be(57.72);
    }

    [Fact]
    public async Task UpdateAsync_ByACoHost_ChangesTheEvent()
    {
        var factory = CreateSeededFactory(db => db.Events.Add(Joined(EventRepositoryTests.NewEvent(1, organizerId: 2), 1, EventParticipantRole.CoHost)));

        var result = await Service(factory).UpdateAsync(User1, "event-1", UpdateOf(EventRepositoryTests.NewEvent(1, 2)), TestContext.Current.CancellationToken);

        result.Value.Should().NotBeNull();
        result.Value.Title.Should().Be("Ny titel");
    }

    [Theory]
    [InlineData(EventParticipantRole.Organizer, true)]
    [InlineData(EventParticipantRole.CoHost, false)]
    public async Task UpdateAsync_OnlyTheOrganizerTogglesParticipantInvites(EventParticipantRole editorRole, bool expected)
    {
        var e = editorRole == EventParticipantRole.Organizer
            ? EventRepositoryTests.NewEvent(1, organizerId: 1)
            : Joined(EventRepositoryTests.NewEvent(1, organizerId: 2), 1, EventParticipantRole.CoHost);
        var factory = CreateSeededFactory(db => db.Events.Add(e));
        var request = UpdateOf(EventRepositoryTests.NewEvent(1, 2));
        request.AllowParticipantInvites = true;

        var result = await Service(factory).UpdateAsync(User1, "event-1", request, TestContext.Current.CancellationToken);

        result.Value.Should().NotBeNull();
        result.Value.Title.Should().Be("Ny titel");
        result.Value.AllowParticipantInvites.Should().Be(expected);
    }

    [Fact]
    public async Task UpdateAsync_KeepsItsOwnTrailAfterItIsUnpublished_ButCannotPickAnotherUnpublishedOne()
    {
        var e = EventRepositoryTests.NewEvent(1, organizerId: 1);
        e.TrailId = 2;
        var factory = CreateSeededFactory(db => db.Events.Add(e));
        using (var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken))
        {
            var trail = await context.Trails.SingleAsync(t => t.Id == 2, TestContext.Current.CancellationToken);
            trail.IsVerified = false;
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var keep = UpdateOf(e);
        keep.TrailIdentifier = Trail2;
        var kept = await Service(factory).UpdateAsync(User1, "event-1", keep, TestContext.Current.CancellationToken);

        var otherEvent = EventRepositoryTests.NewEvent(2, organizerId: 1);
        using (var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken))
        {
            context.Events.Add(otherEvent);
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var pick = UpdateOf(otherEvent);
        pick.TrailIdentifier = Trail2;
        var picked = await Service(factory).UpdateAsync(User1, "event-2", pick, TestContext.Current.CancellationToken);

        kept.Value.Should().NotBeNull();
        kept.Value.TrailIdentifier.Should().Be(Trail2);
        picked.Message.Should().NotBeNull();
        picked.Message.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task UpdateAsync_OfAnOngoingEventWithItsStartUnchanged_IsAllowed()
    {
        var ongoing = EventRepositoryTests.NewEvent(1, organizerId: 1);
        ongoing.StartsAt = DateTime.UtcNow.AddHours(-1);
        ongoing.PastAfter = DateTime.UtcNow.AddHours(5);
        var factory = CreateSeededFactory(db => db.Events.Add(ongoing));

        var unchanged = await Service(factory).UpdateAsync(User1, "event-1", UpdateOf(ongoing), TestContext.Current.CancellationToken);

        var moved = UpdateOf(ongoing);
        moved.StartsAt = ongoing.StartsAt.AddMinutes(-30);
        var movedResult = await Service(factory).UpdateAsync(User1, "event-1", moved, TestContext.Current.CancellationToken);

        unchanged.Value.Should().NotBeNull();
        movedResult.Message.Should().NotBeNull();
        movedResult.Message.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task UpdateAsync_LoweringMaxBelowTheJoinedCount_Is400()
    {
        var full = Joined(Joined(EventRepositoryTests.NewEvent(1, organizerId: 1), 2), 3);
        var factory = CreateSeededFactory(db => db.Events.Add(full));
        var request = UpdateOf(full);
        request.MaxParticipants = 2;

        var result = await Service(factory).UpdateAsync(User1, "event-1", request, TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(400);
    }

    [Theory]
    [InlineData(true, 409)]
    [InlineData(false, 400)]
    public async Task UpdateAsync_WhenTheEventChangesBeforeTheSave_NamesTheReasonFromAReload(bool cancelled, int expectedStatus)
    {
        var factory = CreateSeededFactory(db => db.Events.Add(EventRepositoryTests.NewEvent(1, organizerId: 1)));
        var repository = new Mock<IEventRepository>();
        repository
            .Setup(r => r.UpdateAsync("event-1", It.IsAny<int>(), It.IsAny<Action<Event>>(), It.IsAny<CancellationToken>()))
            .Returns(async () =>
            {
                using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
                var stored = await context.Events.SingleAsync(TestContext.Current.CancellationToken);
                if (cancelled)
                    stored.Status = EventStatus.Cancelled;
                else
                    stored.ParticipantCount = 3;
                await context.SaveChangesAsync(TestContext.Current.CancellationToken);
                return RepositoryResult<UpdatedEvent>.Conflict();
            });
        var request = UpdateOf(EventRepositoryTests.NewEvent(1, organizerId: 1));
        request.MaxParticipants = 2;

        var result = await ServiceWith(factory, repository.Object).UpdateAsync(User1, "event-1", request, TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(expectedStatus);
        result.Message.Code.Should().Be(cancelled ? EventErrorCodes.EventCancelled : null);
    }

    [Fact]
    public async Task UpdateAsync_OfACancelledEvent_Is409EventCancelled()
    {
        var factory = CreateSeededFactory(db => db.Events.Add(EventRepositoryTests.NewEvent(1, organizerId: 1, status: EventStatus.Cancelled)));

        var result = await Service(factory).UpdateAsync(User1, "event-1", UpdateOf(EventRepositoryTests.NewEvent(1, 1)), TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.Code.Should().Be(EventErrorCodes.EventCancelled);
    }

    [Fact]
    public async Task CancelAsync_ByTheOrganizer_PushesTheCancelFromThemWithoutAReason()
    {
        var factory = CreateSeededFactory(db => db.Events.Add(Joined(EventRepositoryTests.NewEvent(1, organizerId: 1), 2)));
        PushMessage? sent = null;
        _pushQueue.Setup(q => q.Enqueue(It.IsAny<PushMessage>())).Callback<PushMessage>(m => sent = m);

        var result = await Service(factory).CancelAsync(User1, "event-1", TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        sent.Should().NotBeNull();
        sent.UserIds.Should().Equal(2);
        sent.FromUserId.Should().Be(1);
        sent.Title.Should().Be("Inställt: Event 1");
        sent.Body.Should().StartWith("Evenemanget den ").And.EndWith(" är inställt.");
        sent.Data["type"].Should().Be(PushTypes.EventCancelled);
    }

    // User 1 organizes, 2 has joined, 3 is interested. keep-comment: the audience of every edit push test
    private static Event WithAudience()
    {
        var e = Joined(EventRepositoryTests.NewEvent(1, organizerId: 1), 2);
        e.Participants.Add(new EventParticipant { UserId = 3, Status = EventParticipantStatus.Interested });
        return e;
    }

    [Fact]
    public async Task UpdateAsync_MovingTheStart_PushesTheNewTimeToJoinedAndInterestedFromTheEditor()
    {
        var e = WithAudience();
        var factory = CreateSeededFactory(db => db.Events.Add(e));
        PushMessage? sent = null;
        _pushQueue.Setup(q => q.Enqueue(It.IsAny<PushMessage>())).Callback<PushMessage>(m => sent = m);
        var request = UpdateOf(e);
        request.StartsAt = new DateTime(2099, 11, 5, 17, 0, 0, DateTimeKind.Utc);

        var result = await Service(factory).UpdateAsync(User1, "event-1", request, TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        sent.Should().NotBeNull();
        sent.UserIds.Should().BeEquivalentTo([2, 3]);
        sent.FromUserId.Should().Be(1);
        sent.Title.Should().Be("Ändrat: Ny titel");
        sent.Body.Should().Be("Ny starttid 5 november kl. 18:00.");
        sent.Data["type"].Should().Be(PushTypes.EventUpdated);
        sent.Data["eventIdentifier"].Should().Be("event-1");
    }

    [Fact]
    public async Task UpdateAsync_MovingTheMeetingPoint_PushesTheNewPlace()
    {
        var e = WithAudience();
        var factory = CreateSeededFactory(db => db.Events.Add(e));
        PushMessage? sent = null;
        _pushQueue.Setup(q => q.Enqueue(It.IsAny<PushMessage>())).Callback<PushMessage>(m => sent = m);
        var request = UpdateOf(e);
        request.MeetingPointLatitude = 57.73m;
        request.EndsAt = e.StartsAt.AddHours(3);

        await Service(factory).UpdateAsync(User1, "event-1", request, TestContext.Current.CancellationToken);

        sent.Should().NotBeNull();
        sent.Body.Should().Be("Ny sluttid och ny mötesplats.");
    }

    [Fact]
    public async Task UpdateAsync_ChangingOnlyTextOrMovingByASlip_PushesNothing()
    {
        var e = WithAudience();
        var factory = CreateSeededFactory(db => db.Events.Add(e));
        var request = UpdateOf(e);
        request.Description = "Ny beskrivning";
        request.StartsAt = e.StartsAt.AddSeconds(-30);
        request.MeetingPointLatitude = 57.72005m;

        var result = await Service(factory).UpdateAsync(User1, "event-1", request, TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        _pushQueue.Verify(q => q.Enqueue(It.IsAny<PushMessage>()), Times.Never);
    }

    [Fact]
    public async Task CancelAsync_OfAPastEvent_Is409EventPastAndPushesNothing()
    {
        var factory = CreateSeededFactory(db => db.Events.Add(Joined(EventRepositoryTests.NewEvent(1, organizerId: 1, startsInDays: -3), 2)));

        var result = await Service(factory).CancelAsync(User1, "event-1", TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(409);
        result.Message.Code.Should().Be(EventErrorCodes.EventPast);
        _pushQueue.Verify(q => q.Enqueue(It.IsAny<PushMessage>()), Times.Never);
    }

    [Fact]
    public async Task CancelAsync_ByACoHost_Is403()
    {
        var factory = CreateSeededFactory(db => db.Events.Add(Joined(EventRepositoryTests.NewEvent(1, organizerId: 2), 1, EventParticipantRole.CoHost)));

        var result = await Service(factory).CancelAsync(User1, "event-1", TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(403);
        _pushQueue.Verify(q => q.Enqueue(It.IsAny<PushMessage>()), Times.Never);
    }

    [Fact]
    public async Task DeleteAsync_ByTheOrganizer_DeletesTheImageFileAfterTheRows()
    {
        var withImage = EventRepositoryTests.NewEvent(1, organizerId: 1);
        withImage.Image = new EventImage { ImageUrl = "events/a.jpeg" };
        var factory = CreateSeededFactory(db => db.Events.Add(withImage));

        var result = await Service(factory).DeleteAsync(User1, "event-1", TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        _webDav.Verify(w => w.DeleteFileAsync("events/a.jpeg"), Times.Once);
    }

    [Theory]
    [InlineData(ModerationState.Visible, true)]
    [InlineData(ModerationState.HiddenPendingReview, false)]
    public async Task GetAsync_GivesTheImageIdentifierOnlyWithAVisibleImage(ModerationState moderation, bool shown)
    {
        var withImage = EventRepositoryTests.NewEvent(1, organizerId: 1);
        withImage.Image = new EventImage { Identifier = "image-1", ImageUrl = "events/a.jpeg", ModerationState = moderation };
        var factory = CreateSeededFactory(db => db.Events.Add(withImage));

        var result = await Service(factory).GetAsync(User1, "event-1", TestContext.Current.CancellationToken);

        result.Value.Should().NotBeNull();
        result.Value.ImageIdentifier.Should().Be(shown ? "image-1" : null);
        result.Value.ImageUrl.Should().Be(shown ? $"{Utilities.Stubs.PresentableBaseUrl}events/a.jpeg" : null);
    }

    [Fact]
    public async Task DeleteAsync_KeepsAnImageFileAnotherEventStillUses()
    {
        var deleted = EventRepositoryTests.NewEvent(1, organizerId: 1);
        deleted.Image = new EventImage { ImageUrl = "events/shared.jpeg" };
        var other = EventRepositoryTests.NewEvent(2, organizerId: 2);
        other.Image = new EventImage { ImageUrl = "/events/shared.jpeg" };
        var factory = CreateSeededFactory(db =>
        {
            db.Events.Add(deleted);
            db.Events.Add(other);
        });

        var result = await Service(factory).DeleteAsync(User1, "event-1", TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        _webDav.Verify(w => w.DeleteFileAsync(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task DeleteAsync_ByTheOrganizer_PushesTheCancelFromThem()
    {
        var factory = CreateSeededFactory(db => db.Events.Add(Joined(EventRepositoryTests.NewEvent(1, organizerId: 1), 2)));
        PushMessage? sent = null;
        _pushQueue.Setup(q => q.Enqueue(It.IsAny<PushMessage>())).Callback<PushMessage>(m => sent = m);

        var result = await Service(factory).DeleteAsync(User1, "event-1", TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        sent.Should().NotBeNull();
        sent.UserIds.Should().Equal(2);
        sent.FromUserId.Should().Be(1);
    }

    [Fact]
    public async Task GetFeedAsync_ExcludeMine_DropsTheSignedInViewersOwnEventsOnly()
    {
        var factory = CreateSeededFactory(db =>
        {
            db.Events.Add(EventRepositoryTests.NewEvent(1, organizerId: 2));
            db.Events.Add(EventRepositoryTests.NewEvent(2, organizerId: 3));
        });
        var service = Service(factory);
        var excluding = new EventFeedQuery { ExcludeMine = true };

        var mine = await service.GetFeedAsync(User3, excluding, TestContext.Current.CancellationToken);
        var anonymous = await service.GetFeedAsync(null, excluding, TestContext.Current.CancellationToken);
        var all = await service.GetFeedAsync(User3, new EventFeedQuery(), TestContext.Current.CancellationToken);

        mine.Value.Should().NotBeNull();
        mine.Value.Items.Select(e => e.Identifier).Should().Equal("event-1");
        anonymous.Value.Should().NotBeNull();
        anonymous.Value.Items.Should().HaveCount(2);
        all.Value.Should().NotBeNull();
        all.Value.Items.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetFeedAsync_ReturnsDistanceAndACursorWhenMoreRemain()
    {
        var factory = CreateSeededFactory(db =>
        {
            db.Events.Add(EventRepositoryTests.NewEvent(1, organizerId: 2, startsInDays: 1));
            db.Events.Add(EventRepositoryTests.NewEvent(2, organizerId: 2, startsInDays: 2, longitude: 12.94 + 0.05));
        });
        var service = Service(factory);

        var first = await service.GetFeedAsync(User3, new EventFeedQuery { Lat = 57.72m, Lon = 12.94m, Limit = 1 }, TestContext.Current.CancellationToken);

        first.Value.Should().NotBeNull();
        first.Value.Items.Should().ContainSingle().Which.DistanceMeters.Should().Be(0);
        first.Value.NextCursor.Should().NotBeNull();

        var second = await service.GetFeedAsync(User3, new EventFeedQuery { Lat = 57.72m, Lon = 12.94m, Limit = 1, Cursor = first.Value.NextCursor }, TestContext.Current.CancellationToken);

        second.Value.Should().NotBeNull();
        second.Value.Items.Should().ContainSingle().Which.DistanceMeters.Should().BeApproximately(2_980, 30);
        second.Value.NextCursor.Should().BeNull();
    }

    private const string OwnHike = "own-hike";
    private const string OtherHike = "other-hike";

    private static Hike RouteHike(int id, string identifier, int userId)
    {
        return new Hike
        {
            Id = id,
            Identifier = identifier,
            Name = "Promenad",
            GeoPath = Utilities.GeoPath((12.940, 57.720), (12.941, 57.721), (12.940, 57.722), (12.941, 57.723), (12.940, 57.724)),
            UserId = userId,
        };
    }

    private static void SeedHikes(StigViddDbContext db)
    {
        db.Hikes.Add(RouteHike(100, OwnHike, userId: 1));
        db.Hikes.Add(RouteHike(101, OtherHike, userId: 2));
    }

    private static Event WithRoute(Event e)
    {
        e.Route = new EventRoute { Path = Utilities.GeoPath((12.95, 57.73), (12.96, 57.74)), LengthMetres = 1234 };
        e.Location = GeoPointFactory.FromLonLat(12.95, 57.73);
        return e;
    }

    private static UpdateEventRequest WithoutPlace(UpdateEventRequest request)
    {
        request.MeetingPointLongitude = null;
        request.MeetingPointLatitude = null;
        return request;
    }

    [Fact]
    public async Task CreateAsync_WithOwnHike_CopiesTheTrimmedRouteAndStartsThere()
    {
        var factory = CreateSeededFactory(SeedHikes);
        var request = Create();
        request.MeetingPointLongitude = null;
        request.MeetingPointLatitude = null;
        request.HikeIdentifier = OwnHike;
        request.RouteTrimStartIndex = 1;
        request.RouteTrimEndIndex = 3;

        var result = await Service(factory).CreateAsync(User1, request, TestContext.Current.CancellationToken);

        result.Value.Should().NotBeNull();
        result.Value.Route.Should().NotBeNull();
        result.Value.Route.Kind.Should().Be("Own");
        result.Value.Route.LengthMeters.Should().BeGreaterThan(200);
        result.Value.Route.Coordinates.Should().StartWith("[{\"latitude\":57.721,\"longitude\":12.941}");

        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var stored = await context.Events.Include(e => e.Route).SingleAsync(TestContext.Current.CancellationToken);
        stored.TrailId.Should().BeNull();
        stored.Location.X.Should().Be(12.941);
        stored.Location.Y.Should().Be(57.721);
        stored.Route.Should().NotBeNull();
        stored.Route.Path.NumPoints.Should().Be(3);
        stored.Route.Path.SRID.Should().Be(4326);
    }

    [Fact]
    public async Task CreateAsync_WithSomeoneElsesHike_AnswersAsForAMissingOne()
    {
        var factory = CreateSeededFactory(SeedHikes);
        var others = Create();
        others.HikeIdentifier = OtherHike;
        var missing = Create();
        missing.HikeIdentifier = "no-such-hike";

        var othersResult = await Service(factory).CreateAsync(User1, others, TestContext.Current.CancellationToken);
        var missingResult = await Service(factory).CreateAsync(User1, missing, TestContext.Current.CancellationToken);

        othersResult.Message.Should().NotBeNull();
        missingResult.Message.Should().NotBeNull();
        othersResult.Message.StatusCode.Should().Be(400);
        othersResult.Message.ResultMessage.Should().Be(missingResult.Message.ResultMessage);
        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        (await context.Events.AnyAsync(TestContext.Current.CancellationToken)).Should().BeFalse();
    }

    [Fact]
    public async Task UpdateAsync_WithoutRouteFields_KeepsTheRouteAndItsStartAsLocation()
    {
        var factory = CreateSeededFactory(db => db.Events.Add(WithRoute(EventRepositoryTests.NewEvent(1, organizerId: 1))));

        var result = await Service(factory).UpdateAsync(User1, "event-1", WithoutPlace(UpdateOf(EventRepositoryTests.NewEvent(1, 1))), TestContext.Current.CancellationToken);

        result.Value.Should().NotBeNull();
        result.Value.Route.Should().NotBeNull();
        result.Value.Route.LengthMeters.Should().Be(1234);
        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var stored = await context.Events.Include(e => e.Route).SingleAsync(TestContext.Current.CancellationToken);
        stored.Route.Should().NotBeNull();
        stored.Location.X.Should().Be(12.95);
        stored.Location.Y.Should().Be(57.73);
    }

    [Fact]
    public async Task UpdateAsync_RemoveRoute_ClearsItButNeedsAnotherPlace()
    {
        var factory = CreateSeededFactory(db => db.Events.Add(WithRoute(EventRepositoryTests.NewEvent(1, organizerId: 1))));
        var placeless = WithoutPlace(UpdateOf(EventRepositoryTests.NewEvent(1, 1)));
        placeless.RemoveRoute = true;
        var withMeetingPoint = UpdateOf(EventRepositoryTests.NewEvent(1, 1));
        withMeetingPoint.RemoveRoute = true;

        var refused = await Service(factory).UpdateAsync(User1, "event-1", placeless, TestContext.Current.CancellationToken);
        var removed = await Service(factory).UpdateAsync(User1, "event-1", withMeetingPoint, TestContext.Current.CancellationToken);

        refused.Message.Should().NotBeNull();
        refused.Message.StatusCode.Should().Be(400);
        removed.Value.Should().NotBeNull();
        removed.Value.Route.Should().BeNull();
        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        (await context.EventRoutes.AnyAsync(TestContext.Current.CancellationToken)).Should().BeFalse();
    }

    [Fact]
    public async Task UpdateAsync_WithATrail_ReplacesTheRoute()
    {
        var factory = CreateSeededFactory(db => db.Events.Add(WithRoute(EventRepositoryTests.NewEvent(1, organizerId: 1))));
        var request = WithoutPlace(UpdateOf(EventRepositoryTests.NewEvent(1, 1)));
        request.TrailIdentifier = Trail2;

        var result = await Service(factory).UpdateAsync(User1, "event-1", request, TestContext.Current.CancellationToken);

        result.Value.Should().NotBeNull();
        result.Value.Route.Should().NotBeNull();
        result.Value.Route.Kind.Should().Be("Trail");
        result.Value.Route.Coordinates.Should().BeNull();
        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        (await context.EventRoutes.AnyAsync(TestContext.Current.CancellationToken)).Should().BeFalse();
        (await context.Events.SingleAsync(TestContext.Current.CancellationToken)).TrailId.Should().Be(2);
    }

    [Fact]
    public async Task UpdateAsync_ByACoHost_CopiesOnlyTheirOwnHike()
    {
        var factory = CreateSeededFactory(db =>
        {
            SeedHikes(db);
            db.Events.Add(Joined(WithRoute(EventRepositoryTests.NewEvent(1, organizerId: 2)), 1, EventParticipantRole.CoHost));
        });
        var organizers = WithoutPlace(UpdateOf(EventRepositoryTests.NewEvent(1, 2)));
        organizers.HikeIdentifier = OtherHike;
        var own = WithoutPlace(UpdateOf(EventRepositoryTests.NewEvent(1, 2)));
        own.HikeIdentifier = OwnHike;

        var refused = await Service(factory).UpdateAsync(User1, "event-1", organizers, TestContext.Current.CancellationToken);
        var swapped = await Service(factory).UpdateAsync(User1, "event-1", own, TestContext.Current.CancellationToken);

        refused.Message.Should().NotBeNull();
        refused.Message.StatusCode.Should().Be(400);
        swapped.Value.Should().NotBeNull();
        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var route = await context.EventRoutes.SingleAsync(TestContext.Current.CancellationToken);
        route.Path.Coordinates[0].X.Should().Be(12.940);
        route.Path.Coordinates[0].Y.Should().Be(57.720);
    }

    [Fact]
    public async Task DeleteAsync_RemovesTheRoute()
    {
        var factory = CreateSeededFactory(db => db.Events.Add(WithRoute(EventRepositoryTests.NewEvent(1, organizerId: 1))));

        var result = await Service(factory).DeleteAsync(User1, "event-1", TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        (await context.EventRoutes.AnyAsync(TestContext.Current.CancellationToken)).Should().BeFalse();
    }

    [Fact]
    public async Task GetMineAsync_ShowsTheRouteKindAndLengthOnTheCard()
    {
        var factory = CreateSeededFactory(db => db.Events.Add(WithRoute(EventRepositoryTests.NewEvent(1, organizerId: 1))));

        var result = await Service(factory).GetMineAsync(User1, new MyEventsQuery(), TestContext.Current.CancellationToken);

        result.Value.Should().NotBeNull();
        var card = result.Value.Items.Should().ContainSingle().Subject;
        card.RouteKind.Should().Be("Own");
        card.RouteLengthMeters.Should().Be(1234);
    }

    [Fact]
    public async Task GetFeedAsync_WithAMalformedCursor_Is400()
    {
        var result = await Service(CreateSeededFactory()).GetFeedAsync(User1, new EventFeedQuery { Cursor = "not-a-cursor" }, TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(400);
    }
}
