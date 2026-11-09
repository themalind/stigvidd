// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Interfaces.Repositories;
using Core.Repositories;
using Core.Repositories.Events;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using IntegrationTests.EventsController;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using NetTopologySuite.Geometries;
using StigviddAPI;
using System.Net;
using System.Net.Http.Json;
using WebDataContracts.RequestModels.Event;
using WebDataContracts.RequestModels.Hike;
using WebDataContracts.RequestModels.TrailObstacle;
using WebDataContracts.ResponseModels.Event;
using WebDataContracts.ResponseModels.Hike;

namespace IntegrationTests.Repositories;

// The unique index is what stops a racing retry, and the in-memory provider ignores it. keep-comment: why these are not unit tests
public class RetriedCreateIntegrationTests : IClassFixture<BoardWebApplicationFactory>
{
    private const string Coordinates = "[{\"latitude\":57.62,\"longitude\":12.81},{\"latitude\":57.64,\"longitude\":12.83}]";
    private const string TrailIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c";
    private const int NaturElskaren = 1;
    private const int VandrarVennen = 2;
    private const int Trail1 = 1;

    private readonly BoardWebApplicationFactory _factory;

    public RetriedCreateIntegrationTests(BoardWebApplicationFactory factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    private IDbContextFactory<StigViddDbContext> Db => _factory.Services.GetRequiredService<IDbContextFactory<StigViddDbContext>>();

    private HttpClient Client(string subject)
    {
        return BoardRequests.Client(_factory, subject);
    }

    private static CreateHikeRequest HikeRequest(Guid? key)
    {
        return new CreateHikeRequest { Name = "Kvällspromenad", HikeLength = 1000, Duration = 60000, Coordinates = Coordinates, ClientRequestId = key };
    }

    private static CreateEventRequest EventRequest(Guid? key)
    {
        return new CreateEventRequest
        {
            Title = "Kvällsvandring",
            Description = "Runt sjön",
            Visibility = "Open",
            MeetingPointLongitude = 12.94m,
            MeetingPointLatitude = 57.72m,
            StartsAt = DateTime.UtcNow.AddDays(3),
            ClientRequestId = key,
        };
    }

    private async Task<HttpResponseMessage> PostHikeAsync(string subject, Guid? key)
    {
        return await Client(subject).PostAsJsonAsync("/api/v1/hikes", HikeRequest(key), Token);
    }

    private async Task<int> CountAsync<T>(Func<StigViddDbContext, IQueryable<T>> rows)
    {
        await using var db = await Db.CreateDbContextAsync(Token);
        return await rows(db).CountAsync(Token);
    }

    private static Hike NewHike(Guid key)
    {
        return new Hike
        {
            Name = "Kvällspromenad",
            HikeLength = 1,
            Duration = 60000,
            GeoPath = GeoPointFactory.FromLonLatPath([new Coordinate(12.81, 57.62), new Coordinate(12.83, 57.64)]),
            UserId = NaturElskaren,
            ClientRequestId = key,
        };
    }

    private static TrailObstacle NewObstacle(Guid key)
    {
        return new TrailObstacle
        {
            Description = "Stort träd över stigen",
            IssueType = TrailIssueType.FallenTree,
            TrailId = Trail1,
            UserId = NaturElskaren,
            ClientRequestId = key,
        };
    }

    private static Event NewEvent(Guid key)
    {
        return new Event
        {
            Title = "Kvällsvandring",
            Description = "Runt sjön",
            Location = GeoPointFactory.FromLonLat(12.94, 57.72),
            StartsAt = DateTime.UtcNow.AddDays(3),
            PastAfter = DateTime.UtcNow.AddDays(4),
            Visibility = EventVisibility.Open,
            Status = EventStatus.Published,
            ClientRequestId = key,
        };
    }

    private async Task AddAsync(object row)
    {
        await using var db = await Db.CreateDbContextAsync(Token);
        db.Add(row);
        await db.SaveChangesAsync(Token);
    }

    // Saves the competing row just before the repository's own save, once. keep-comment: past the first lookup, which is the whole race
    private sealed class CompeteOnFirstSave(Func<Task> compete) : SaveChangesInterceptor
    {
        private bool _armed = true;

        public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            if (_armed)
            {
                _armed = false;
                await compete();
            }

            return result;
        }
    }

    // SQLite shares one connection, so the competitor is rolled back too; on Postgres it is already committed. keep-comment: why the row is put back
    private sealed class RestoreAfterRollback(Func<Task> restore) : DbTransactionInterceptor
    {
        public override async Task TransactionRolledBackAsync(System.Data.Common.DbTransaction transaction, TransactionEndEventData eventData, CancellationToken cancellationToken = default)
        {
            await restore();
        }
    }

    private sealed class RacingFactory(DbContextOptions<StigViddDbContext> options, params IInterceptor[] interceptors) : IDbContextFactory<StigViddDbContext>
    {
        public StigViddDbContext CreateDbContext()
        {
            return new StigViddDbContext(new DbContextOptionsBuilder<StigViddDbContext>(options).AddInterceptors(interceptors).Options);
        }
    }

    private RacingFactory Racing(object competitor)
    {
        return new RacingFactory(
            _factory.Services.GetRequiredService<DbContextOptions<StigViddDbContext>>(),
            new CompeteOnFirstSave(() => AddAsync(competitor)));
    }

    [Fact]
    public async Task Hike_SentTwiceWithOneKey_IsOneHikeAndAnswersWithIt()
    {
        var key = Guid.NewGuid();

        var first = await PostHikeAsync(BoardRequests.NaturElskaren, key);
        var second = await PostHikeAsync(BoardRequests.NaturElskaren, key);

        first.StatusCode.Should().Be(HttpStatusCode.Created);
        second.StatusCode.Should().Be(HttpStatusCode.Created);
        var firstHike = await first.Content.ReadFromJsonAsync<HikeResponse>(Token);
        var secondHike = await second.Content.ReadFromJsonAsync<HikeResponse>(Token);
        firstHike.Should().NotBeNull();
        secondHike.Should().NotBeNull();
        secondHike.Identifier.Should().Be(firstHike.Identifier);
        (await CountAsync(db => db.Hikes.Where(h => h.ClientRequestId == key))).Should().Be(1);
    }

    [Fact]
    public async Task Hike_WithoutAKey_StillCreatesOnePerRequest()
    {
        var before = await CountAsync(db => db.Hikes);

        await PostHikeAsync(BoardRequests.NaturElskaren, null);
        await PostHikeAsync(BoardRequests.NaturElskaren, null);

        (await CountAsync(db => db.Hikes)).Should().Be(before + 2);
    }

    [Fact]
    public async Task Hike_WithAnotherUsersKey_IsSavedAsTheirOwn()
    {
        var key = Guid.NewGuid();
        var first = await PostHikeAsync(BoardRequests.NaturElskaren, key);

        var second = await PostHikeAsync(BoardRequests.VandrarVennen, key);

        second.StatusCode.Should().Be(HttpStatusCode.Created);
        var firstHike = await first.Content.ReadFromJsonAsync<HikeResponse>(Token);
        var secondHike = await second.Content.ReadFromJsonAsync<HikeResponse>(Token);
        firstHike.Should().NotBeNull();
        secondHike.Should().NotBeNull();
        secondHike.Identifier.Should().NotBe(firstHike.Identifier);
        (await CountAsync(db => db.Hikes.Where(h => h.ClientRequestId == key))).Should().Be(2);
    }

    [Fact]
    public async Task Hike_WhoseFirstAttemptIsStillInFlight_AnswersWithTheWinner()
    {
        var key = Guid.NewGuid();
        var repo = new HikeRepository(Racing(NewHike(key)), NullLogger<HikeRepository>.Instance);

        var result = await repo.CreateHikeAsync(NewHike(key), Token);

        result.IsSuccess.Should().BeTrue();
        (await CountAsync(db => db.Hikes.Where(h => h.ClientRequestId == key))).Should().Be(1);
    }

    [Fact]
    public async Task Hike_FailingForAnotherReason_IsStillAnError()
    {
        var hike = NewHike(Guid.NewGuid());
        hike.UserId = 999_999;
        var repo = new HikeRepository(Db, NullLogger<HikeRepository>.Instance);

        var result = await repo.CreateHikeAsync(hike, Token);

        result.Status.Should().Be(RepositoryResultStatus.Error);
    }

    [Fact]
    public async Task Obstacle_SentTwiceWithOneKey_IsOneObstacle()
    {
        var key = Guid.NewGuid();
        var request = new TrailObstacleRequest
        {
            TrailIdentifier = TrailIdentifier,
            Description = "Stort träd har fallit över stigen, svårt att passera.",
            IssueType = "FallenTree",
            ClientRequestId = key,
        };

        var first = await Client(BoardRequests.VandrarVennen).PostAsJsonAsync("/api/v1/trailobstacles", request, Token);
        var second = await Client(BoardRequests.VandrarVennen).PostAsJsonAsync("/api/v1/trailobstacles", request, Token);

        first.StatusCode.Should().Be(HttpStatusCode.Created);
        second.StatusCode.Should().Be(HttpStatusCode.Created);
        (await CountAsync(db => db.TrailObstacles.Where(o => o.ClientRequestId == key))).Should().Be(1);
    }

    [Fact]
    public async Task Obstacle_WithAnotherUsersKey_IsSavedAsTheirOwn()
    {
        var key = Guid.NewGuid();
        var repo = new TrailObstacleRepository(Db, NullLogger<TrailObstacleRepository>.Instance, _factory.Services.GetRequiredService<IConfiguration>());
        var theirs = NewObstacle(key);
        theirs.UserId = VandrarVennen;

        var first = await repo.AddTrailObstacleAsync(NewObstacle(key), Token);
        var second = await repo.AddTrailObstacleAsync(theirs, Token);

        first.IsSuccess.Should().BeTrue();
        second.IsSuccess.Should().BeTrue();
        second.Value.Should().NotBeNull();
        second.Value.UserId.Should().Be(VandrarVennen);
        (await CountAsync(db => db.TrailObstacles.Where(o => o.ClientRequestId == key))).Should().Be(2);
    }

    [Fact]
    public async Task Obstacle_WhoseFirstAttemptIsStillInFlight_AnswersWithTheWinner()
    {
        var key = Guid.NewGuid();
        var repo = new TrailObstacleRepository(Racing(NewObstacle(key)), NullLogger<TrailObstacleRepository>.Instance, _factory.Services.GetRequiredService<IConfiguration>());

        var result = await repo.AddTrailObstacleAsync(NewObstacle(key), Token);

        result.IsSuccess.Should().BeTrue();
        (await CountAsync(db => db.TrailObstacles.Where(o => o.ClientRequestId == key))).Should().Be(1);
    }

    [Fact]
    public async Task Event_SentTwiceWithOneKey_IsOneEventAndAnswersWithIt()
    {
        var key = Guid.NewGuid();
        var request = EventRequest(key);

        var first = await Client(BoardRequests.NaturElskaren).PostAsJsonAsync(BoardRequests.BASE_URL, request, Token);
        var second = await Client(BoardRequests.NaturElskaren).PostAsJsonAsync(BoardRequests.BASE_URL, request, Token);

        first.StatusCode.Should().Be(HttpStatusCode.Created);
        second.StatusCode.Should().Be(HttpStatusCode.Created);
        var firstEvent = await first.Content.ReadFromJsonAsync<EventResponse>(Token);
        var secondEvent = await second.Content.ReadFromJsonAsync<EventResponse>(Token);
        firstEvent.Should().NotBeNull();
        secondEvent.Should().NotBeNull();
        secondEvent.Identifier.Should().Be(firstEvent.Identifier);
        (await CountAsync(db => db.Events.Where(e => e.ClientRequestId == key))).Should().Be(1);
    }

    [Fact]
    public async Task Event_WhoseFirstAttemptIsStillInFlight_AnswersWithTheWinner()
    {
        var key = Guid.NewGuid();
        var winner = NewEvent(key);
        winner.Participants.Add(new EventParticipant { UserId = NaturElskaren, Role = EventParticipantRole.Organizer, Status = EventParticipantStatus.Joined });
        var repo = new EventRepository(Racing(winner), NullLogger<EventRepository>.Instance);

        var result = await repo.CreateAsync(NewEvent(key), NaturElskaren, TimeSpan.FromDays(1), Token);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be(winner.Identifier);
        (await CountAsync(db => db.Events.Where(e => e.ClientRequestId == key))).Should().Be(1);
    }

    [Fact]
    public async Task Post_SentTwiceWithOneKey_IsOnePostAndPushesOnce()
    {
        var identifier = await BoardRequests.CreateBoardAsync(_factory);
        await using var db = await Db.CreateDbContextAsync(Token);
        var eventId = await db.Events.Where(e => e.Identifier == identifier).Select(e => e.Id).SingleAsync(Token);
        var repo = _factory.Services.GetRequiredService<IEventPostRepository>();
        var key = Guid.NewGuid();

        var first = await repo.CreateAsync(eventId, NaturElskaren, "Vi ses vid parkeringen", key, DateTime.UtcNow, TimeSpan.Zero, Token);
        var second = await repo.CreateAsync(eventId, NaturElskaren, "Vi ses vid parkeringen", key, DateTime.UtcNow, TimeSpan.Zero, Token);

        first.Value.Should().NotBeNull();
        second.Value.Should().NotBeNull();
        first.Value.NotifyUserIds.Should().Equal(VandrarVennen);
        second.Value.NotifyUserIds.Should().BeEmpty();
        second.Value.Post.Identifier.Should().Be(first.Value.Post.Identifier);
        second.Value.Post.NickName.Should().Be(first.Value.Post.NickName);
        (await CountAsync(context => context.EventPosts.Where(p => p.ClientRequestId == key))).Should().Be(1);
    }

    [Fact]
    public async Task Post_WithAnotherUsersKey_IsPostedAsTheirOwn()
    {
        var identifier = await BoardRequests.CreateBoardAsync(_factory);
        await using var db = await Db.CreateDbContextAsync(Token);
        var eventId = await db.Events.Where(e => e.Identifier == identifier).Select(e => e.Id).SingleAsync(Token);
        var repo = _factory.Services.GetRequiredService<IEventPostRepository>();
        var key = Guid.NewGuid();

        var first = await repo.CreateAsync(eventId, NaturElskaren, "Vi ses vid parkeringen", key, DateTime.UtcNow, TimeSpan.Zero, Token);
        var second = await repo.CreateAsync(eventId, VandrarVennen, "Jag tar med fika", key, DateTime.UtcNow, TimeSpan.Zero, Token);

        first.Value.Should().NotBeNull();
        second.Value.Should().NotBeNull();
        second.Value.Post.Identifier.Should().NotBe(first.Value.Post.Identifier);
        second.Value.Post.Body.Should().Be("Jag tar med fika");
        (await CountAsync(context => context.EventPosts.Where(p => p.ClientRequestId == key))).Should().Be(2);
    }

    [Fact]
    public async Task Post_WhoseFirstAttemptIsStillInFlight_AnswersWithTheWinnerAndPushesNothing()
    {
        var identifier = await BoardRequests.CreateBoardAsync(_factory);
        await using var db = await Db.CreateDbContextAsync(Token);
        var eventId = await db.Events.Where(e => e.Identifier == identifier).Select(e => e.Id).SingleAsync(Token);
        var key = Guid.NewGuid();
        var winner = new EventPost { EventId = eventId, UserId = NaturElskaren, Body = "Vi ses", ClientRequestId = key };
        var racing = new RacingFactory(
            _factory.Services.GetRequiredService<DbContextOptions<StigViddDbContext>>(),
            new CompeteOnFirstSave(() => AddAsync(new EventPost { EventId = eventId, UserId = NaturElskaren, Body = "Vi ses", ClientRequestId = key })),
            new RestoreAfterRollback(() => AddAsync(winner)));
        var repo = new EventPostRepository(racing, NullLogger<EventPostRepository>.Instance);

        var result = await repo.CreateAsync(eventId, NaturElskaren, "Vi ses", key, DateTime.UtcNow, TimeSpan.Zero, Token);

        result.Value.Should().NotBeNull();
        result.Value.Post.Identifier.Should().Be(winner.Identifier);
        result.Value.NotifyUserIds.Should().BeEmpty();
        (await CountAsync(context => context.EventPosts.Where(p => p.ClientRequestId == key))).Should().Be(1);
    }
}

public class OneEventPerDayWebApplicationFactory : StigViddWebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.ConfigureAppConfiguration(config => config.AddInMemoryCollection(new Dictionary<string, string?> { ["Events:CreatedPerDay"] = "1" }));
    }
}

public class RetriedEventAtTheDailyLimitTests : IClassFixture<OneEventPerDayWebApplicationFactory>
{
    private readonly OneEventPerDayWebApplicationFactory _factory;

    public RetriedEventAtTheDailyLimitTests(OneEventPerDayWebApplicationFactory factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    [Fact]
    public async Task Event_RetriedAtTheDailyLimit_IsAnsweredWhileANewOneIsRefused()
    {
        var ctoken = TestContext.Current.CancellationToken;
        var client = BoardRequests.Client(_factory, BoardRequests.NaturElskaren);
        var request = new CreateEventRequest
        {
            Title = "Kvällsvandring",
            Description = "Runt sjön",
            Visibility = "Open",
            MeetingPointLongitude = 12.94m,
            MeetingPointLatitude = 57.72m,
            StartsAt = DateTime.UtcNow.AddDays(3),
            ClientRequestId = Guid.NewGuid(),
        };

        var first = await client.PostAsJsonAsync(BoardRequests.BASE_URL, request, ctoken);
        var retried = await client.PostAsJsonAsync(BoardRequests.BASE_URL, request, ctoken);
        request.ClientRequestId = Guid.NewGuid();
        var another = await client.PostAsJsonAsync(BoardRequests.BASE_URL, request, ctoken);

        first.StatusCode.Should().Be(HttpStatusCode.Created);
        retried.StatusCode.Should().Be(HttpStatusCode.Created);
        another.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
    }
}
