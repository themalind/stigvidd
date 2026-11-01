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
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using UnitTests.RepositoryTests;
using WebDataContracts.RequestModels.Event;

namespace UnitTests.ServiceTests;

public class EventBoardServiceTests : TestBase
{
    private const string User1 = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
    private const string User2 = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";

    private static readonly DateTime Start = DateTime.UtcNow.AddHours(-2);

    private readonly Mock<IPushQueue> _pushQueue = new();

    private EventBoardService Service(IDbContextFactory<StigViddDbContext> factory, params int[] hiddenUserIds)
    {
        var blocks = Utilities.MockFactory.UserBlockServiceHiding(hiddenUserIds).Object;

        return new EventBoardService(
            new EventLoader(
                new EventRepository(factory, NullLogger<EventRepository>.Instance),
                new UserRepository(factory, NullLogger<UserRepository>.Instance),
                blocks),
            new EventPostRepository(factory, NullLogger<EventPostRepository>.Instance),
            _pushQueue.Object,
            Options.Create(new EventLimits()));
    }

    // User 1 organizes event-1; the others join as given. keep-comment: the seed every test starts from
    private static Event Board(params (int UserId, EventParticipantStatus Status)[] others)
    {
        var e = EventRepositoryTests.NewEvent(1, organizerId: 1);

        foreach (var (userId, status) in others)
            e.Participants.Add(new EventParticipant { UserId = userId, Status = status });

        e.ParticipantCount = e.Participants.Count(p => p.Status == EventParticipantStatus.Joined);
        return e;
    }

    private static EventPost Post(int id, int? userId, int minutesAfterStart, bool pinned = false, ModerationState moderation = ModerationState.Visible)
    {
        return new EventPost
        {
            Id = id,
            Identifier = $"post-{id}",
            EventId = 1,
            UserId = userId,
            Body = $"Inlägg {id}",
            CreatedAt = Start.AddMinutes(minutesAfterStart),
            IsPinned = pinned,
            ModerationState = moderation,
        };
    }

    private static IDbContextFactory<StigViddDbContext> Seeded(Event e, params EventPost[] posts)
    {
        return CreateSeededFactory(db =>
        {
            db.Events.Add(e);
            db.EventPosts.AddRange(posts);
        });
    }

    private static async Task<EventParticipant> RowOf(IDbContextFactory<StigViddDbContext> factory, int userId)
    {
        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        return await context.EventParticipants.AsNoTracking().SingleAsync(p => p.UserId == userId, TestContext.Current.CancellationToken);
    }

    private static async Task<EventPost?> PostOf(IDbContextFactory<StigViddDbContext> factory, int id)
    {
        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        return await context.EventPosts.IgnoreQueryFilters().AsNoTracking().FirstOrDefaultAsync(p => p.Id == id, TestContext.Current.CancellationToken);
    }

    private static async Task<EventPost> StoredPost(IDbContextFactory<StigViddDbContext> factory, int id)
    {
        var post = await PostOf(factory, id);
        post.Should().NotBeNull();
        return post;
    }

    [Fact]
    public async Task GetBoardAsync_PagesBackwardsOldestFirstWithinAPage()
    {
        var factory = Seeded(Board((2, EventParticipantStatus.Joined)),
            Post(1, 1, 1), Post(2, 2, 2), Post(3, 1, 3), Post(4, 2, 4), Post(5, 1, 5));
        var service = Service(factory);

        var first = await service.GetBoardAsync(User2, "event-1", new EventBoardQuery { Limit = 2 }, TestContext.Current.CancellationToken);

        first.Value.Should().NotBeNull();
        first.Value.Posts.Select(p => p.Identifier).Should().Equal("post-4", "post-5");
        first.Value.NextCursor.Should().NotBeNull();

        var second = await service.GetBoardAsync(User2, "event-1", new EventBoardQuery { Limit = 2, Cursor = first.Value.NextCursor }, TestContext.Current.CancellationToken);

        second.Value.Should().NotBeNull();
        second.Value.Posts.Select(p => p.Identifier).Should().Equal("post-2", "post-3");

        var last = await service.GetBoardAsync(User2, "event-1", new EventBoardQuery { Limit = 2, Cursor = second.Value.NextCursor }, TestContext.Current.CancellationToken);

        last.Value.Should().NotBeNull();
        last.Value.Posts.Select(p => p.Identifier).Should().Equal("post-1");
        last.Value.NextCursor.Should().BeNull();
    }

    [Fact]
    public async Task GetBoardAsync_GivesPinnedPostsOnTheFirstPageOnly()
    {
        var factory = Seeded(Board((2, EventParticipantStatus.Joined)),
            Post(1, 1, 1, pinned: true), Post(2, 2, 2), Post(3, 1, 3));
        var service = Service(factory);

        var first = await service.GetBoardAsync(User2, "event-1", new EventBoardQuery { Limit = 2 }, TestContext.Current.CancellationToken);

        first.Value.Should().NotBeNull();
        first.Value.Pinned.Select(p => p.Identifier).Should().Equal("post-1");

        var second = await service.GetBoardAsync(User2, "event-1", new EventBoardQuery { Limit = 2, Cursor = first.Value.NextCursor }, TestContext.Current.CancellationToken);

        second.Value.Should().NotBeNull();
        second.Value.Pinned.Should().BeEmpty();
        second.Value.Posts.Single().IsPinned.Should().BeTrue();
    }

    [Fact]
    public async Task GetBoardAsync_LeavesOutHiddenAuthorsAndReportedPosts()
    {
        var factory = Seeded(Board((2, EventParticipantStatus.Joined), (3, EventParticipantStatus.Joined)),
            Post(1, 1, 1), Post(2, 3, 2), Post(3, 1, 3, moderation: ModerationState.HiddenPendingReview), Post(4, null, 4));

        var result = await Service(factory, 3).GetBoardAsync(User2, "event-1", new EventBoardQuery(), TestContext.Current.CancellationToken);

        result.Value.Should().NotBeNull();
        result.Value.Posts.Select(p => p.Identifier).Should().Equal("post-1", "post-4");
        result.Value.Posts.Last().AuthorNickName.Should().BeNull();
    }

    [Fact]
    public async Task GetBoardAsync_ReturnsTheReadMarkerWithoutMovingIt()
    {
        var e = Board((2, EventParticipantStatus.Joined));
        e.Participants.Single(p => p.UserId == 2).LastReadPostAt = Start;
        var factory = Seeded(e, Post(1, 1, 1));

        var result = await Service(factory).GetBoardAsync(User2, "event-1", new EventBoardQuery(), TestContext.Current.CancellationToken);

        result.Value.Should().NotBeNull();
        result.Value.LastReadPostAt.Should().Be(Start);
        (await RowOf(factory, 2)).LastReadPostAt.Should().Be(Start);
    }

    [Theory]
    [InlineData(EventParticipantStatus.Interested, 403, EventErrorCodes.NotAllowed)]
    [InlineData(EventParticipantStatus.Removed, 403, EventErrorCodes.RemovedFromEvent)]
    public async Task GetBoardAsync_ForSomeoneNotJoined_IsRefused(EventParticipantStatus status, int statusCode, string code)
    {
        var factory = Seeded(Board((2, status)), Post(1, 1, 1));

        var result = await Service(factory).GetBoardAsync(User2, "event-1", new EventBoardQuery(), TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(statusCode);
        result.Message.Code.Should().Be(code);
    }

    [Fact]
    public async Task GetBoardAsync_WithABadCursor_Is400()
    {
        var factory = Seeded(Board((2, EventParticipantStatus.Joined)));

        var result = await Service(factory).GetBoardAsync(User2, "event-1", new EventBoardQuery { Cursor = "not-a-cursor" }, TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task CreatePostAsync_PushesNobodyWhoIsMutedThrottledOnlyInterestedOrBlockedTheAuthor()
    {
        var e = Board(
            (2, EventParticipantStatus.Joined),
            (3, EventParticipantStatus.Joined),
            (4, EventParticipantStatus.Joined),
            (5, EventParticipantStatus.Interested));
        e.Participants.Single(p => p.UserId == 3).MutePosts = true;
        e.Participants.Single(p => p.UserId == 4).LastPostPushAt = DateTime.UtcNow.AddMinutes(-1);
        var factory = CreateSeededFactory(db =>
        {
            db.Events.Add(e);
            db.UserBlocks.Add(new UserBlock { BlockerUserId = 1, BlockedUserId = 2 });
        });

        var result = await Service(factory).CreatePostAsync(User2, "event-1", new EventPostRequest { Body = "  Vi ses vid parkeringen!  " }, TestContext.Current.CancellationToken);

        result.Value.Should().NotBeNull();
        result.Value.Body.Should().Be("Vi ses vid parkeringen!");
        result.Value.IsMine.Should().BeTrue();
        _pushQueue.Verify(q => q.Enqueue(It.IsAny<PushMessage>()), Times.Never);
        (await RowOf(factory, 1)).LastPostPushAt.Should().BeNull();
        (await RowOf(factory, 4)).LastPostPushAt.Should().BeBefore(DateTime.UtcNow.AddSeconds(-30));
    }

    [Fact]
    public async Task CreatePostAsync_PushesTheOthersAndStartsTheirThrottle()
    {
        var e = Board((2, EventParticipantStatus.Joined), (3, EventParticipantStatus.Joined));
        e.Participants.Single(p => p.UserId == 3).LastPostPushAt = DateTime.UtcNow.AddHours(-1);
        var factory = Seeded(e);

        var result = await Service(factory).CreatePostAsync(User2, "event-1", new EventPostRequest { Body = "Hej!" }, TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        _pushQueue.Verify(q => q.Enqueue(It.Is<PushMessage>(m =>
            m.Data["type"].Equals(PushTypes.EventPost)
            && m.UserIds.OrderBy(id => id).SequenceEqual(new[] { 1, 3 })
            && m.FromUserId == 2
            && m.Title == "Event 1"
            && m.Body == "VandrarVennen: Hej!")), Times.Once);
        (await RowOf(factory, 1)).LastPostPushAt.Should().BeAfter(DateTime.UtcNow.AddMinutes(-1));
        (await RowOf(factory, 3)).LastPostPushAt.Should().BeAfter(DateTime.UtcNow.AddMinutes(-1));
        (await RowOf(factory, 2)).LastPostPushAt.Should().BeNull();
    }

    [Fact]
    public async Task CreatePostAsync_OnAPastEvent_IsAllowed()
    {
        var e = Board((2, EventParticipantStatus.Joined));
        e.StartsAt = DateTime.UtcNow.AddDays(-3);
        e.PastAfter = DateTime.UtcNow.AddDays(-2);
        var factory = Seeded(e);

        var result = await Service(factory).CreatePostAsync(User2, "event-1", new EventPostRequest { Body = "Tack för i lördags!" }, TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task CreatePostAsync_AfterBeingRemoved_Is403RemovedFromEvent()
    {
        var factory = Seeded(Board((2, EventParticipantStatus.Removed)));

        var result = await Service(factory).CreatePostAsync(User2, "event-1", new EventPostRequest { Body = "Hej!" }, TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(403);
        result.Message.Code.Should().Be(EventErrorCodes.RemovedFromEvent);
    }

    [Fact]
    public async Task MarkReadAsync_OnlyMovesTheMarkerForwardAndNeverPastNow()
    {
        var e = Board((2, EventParticipantStatus.Joined));
        e.Participants.Single(p => p.UserId == 2).LastReadPostAt = Start;
        var factory = Seeded(e);
        var service = Service(factory);

        await service.MarkReadAsync(User2, "event-1", new EventPostsReadRequest { ReadUpTo = Start.AddMinutes(-5) }, TestContext.Current.CancellationToken);
        (await RowOf(factory, 2)).LastReadPostAt.Should().Be(Start);

        var result = await service.MarkReadAsync(User2, "event-1", new EventPostsReadRequest { ReadUpTo = DateTime.UtcNow.AddDays(1) }, TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        (await RowOf(factory, 2)).LastReadPostAt.Should().BeOnOrBefore(DateTime.UtcNow);
    }

    [Fact]
    public async Task UpdatePostAsync_ByTheAuthor_SetsEditedAt()
    {
        var factory = Seeded(Board((2, EventParticipantStatus.Joined)), Post(1, 2, 1));

        var result = await Service(factory).UpdatePostAsync(User2, "post-1", new EventPostRequest { Body = "Rättat" }, TestContext.Current.CancellationToken);

        result.Value.Should().NotBeNull();
        result.Value.Body.Should().Be("Rättat");
        result.Value.EditedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task UpdatePostAsync_BySomeoneElse_Is403EvenForTheOrganizer()
    {
        var factory = Seeded(Board((2, EventParticipantStatus.Joined)), Post(1, 2, 1));

        var result = await Service(factory).UpdatePostAsync(User1, "post-1", new EventPostRequest { Body = "Rättat" }, TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.Code.Should().Be(EventErrorCodes.NotAllowed);
        (await StoredPost(factory, 1)).Body.Should().Be("Inlägg 1");
    }

    [Fact]
    public async Task UpdatePostAsync_OnAReportedPost_Is404PostGone()
    {
        var factory = Seeded(Board((2, EventParticipantStatus.Joined)), Post(1, 2, 1, moderation: ModerationState.HiddenPendingReview));

        var result = await Service(factory).UpdatePostAsync(User2, "post-1", new EventPostRequest { Body = "Rättat" }, TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.Code.Should().Be(EventErrorCodes.PostGone);
    }

    [Fact]
    public async Task DeletePostAsync_ByTheAuthorAfterLeavingAPrivateEvent_DeletesIt()
    {
        var e = Board();
        e.Visibility = EventVisibility.Private;
        var factory = Seeded(e, Post(1, 2, 1));

        var result = await Service(factory).DeletePostAsync(User2, "post-1", TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        (await PostOf(factory, 1)).Should().BeNull();
    }

    [Fact]
    public async Task DeletePostAsync_ByAnotherParticipant_Is403AndKeepsThePost()
    {
        var factory = Seeded(Board((2, EventParticipantStatus.Joined)), Post(1, 1, 1));

        var result = await Service(factory).DeletePostAsync(User2, "post-1", TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.Code.Should().Be(EventErrorCodes.NotAllowed);
        (await PostOf(factory, 1)).Should().NotBeNull();
    }

    [Fact]
    public async Task DeletePostAsync_ByAHost_DeletesSomeoneElsesPost()
    {
        var factory = Seeded(Board((2, EventParticipantStatus.Joined)), Post(1, 2, 1));

        var result = await Service(factory).DeletePostAsync(User1, "post-1", TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        (await PostOf(factory, 1)).Should().BeNull();
    }

    [Fact]
    public async Task DeletePostAsync_WhenAlreadyGone_IsOk()
    {
        var factory = Seeded(Board((2, EventParticipantStatus.Joined)));

        var result = await Service(factory).DeletePostAsync(User2, "post-1", TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task SetPinnedAsync_ByAParticipant_Is403()
    {
        var factory = Seeded(Board((2, EventParticipantStatus.Joined)), Post(1, 2, 1));

        var result = await Service(factory).SetPinnedAsync(User2, "post-1", new EventPostPinRequest { Pinned = true }, TestContext.Current.CancellationToken);

        result.Message.Should().NotBeNull();
        result.Message.Code.Should().Be(EventErrorCodes.NotAllowed);
        (await StoredPost(factory, 1)).IsPinned.Should().BeFalse();
    }

    [Fact]
    public async Task SetPinnedAsync_ByAHost_PinsAndUnpins()
    {
        var factory = Seeded(Board((2, EventParticipantStatus.Joined)), Post(1, 2, 1));
        var service = Service(factory);

        await service.SetPinnedAsync(User1, "post-1", new EventPostPinRequest { Pinned = true }, TestContext.Current.CancellationToken);
        (await StoredPost(factory, 1)).IsPinned.Should().BeTrue();

        await service.SetPinnedAsync(User1, "post-1", new EventPostPinRequest { Pinned = false }, TestContext.Current.CancellationToken);
        (await StoredPost(factory, 1)).IsPinned.Should().BeFalse();
    }

    [Fact]
    public void Post_CutsALongBodyAndKeepsItOnOneLine()
    {
        var push = EventPushes.Post("event-1", "Kvällsvandring", "Maja", $"Rad ett\nrad två {new string('x', 100)}", [1], 2);

        push.Body.Should().StartWith("Maja: Rad ett rad två ");
        push.Body.Should().EndWith("…");
        push.Body.Length.Should().Be("Maja: ".Length + EventPushes.PostSnippetLength + 1);
    }

    [Fact]
    public void Post_NeverCutsAnEmojiInHalf()
    {
        var body = $"{new string('x', EventPushes.PostSnippetLength - 1)}🥾 och mer";

        var push = EventPushes.Post("event-1", "Kvällsvandring", "Maja", body, [1], 2);

        push.Body.Should().Be($"Maja: {new string('x', EventPushes.PostSnippetLength - 1)}…");
    }
}
