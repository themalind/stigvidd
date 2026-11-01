// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Spatial;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using NetTopologySuite.Geometries;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using WebDataContracts.RequestModels.Event;
using WebDataContracts.ResponseModels.Event;

namespace IntegrationTests.EventsController;

public class EventsControllerTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private const string BASE_URL = "/api/v1/events";
    private const string NaturElskaren = "firebase-uid-12345";
    private const string VandrarVennen = "firebase-uid-12346";
    private const string Tiveden = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c";

    private readonly StigViddWebApplicationFactory<Program> _factory;

    public EventsControllerTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    private HttpClient Client(string subject)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", subject);
        return client;
    }

    private StigViddDbContext Db()
    {
        return _factory.Services.GetRequiredService<IDbContextFactory<StigViddDbContext>>().CreateDbContext();
    }

    private static CreateEventRequest Request(string visibility = "Open", string? trail = null)
    {
        return new CreateEventRequest
        {
            Title = "Kvällsvandring",
            Description = "Runt sjön",
            Visibility = visibility,
            TrailIdentifier = trail,
            MeetingPointLongitude = trail is null ? 12.94m : null,
            MeetingPointLatitude = trail is null ? 57.72m : null,
            StartsAt = DateTime.UtcNow.AddDays(3),
        };
    }

    private async Task<EventResponse> CreateAsync(string subject, CreateEventRequest request)
    {
        var response = await Client(subject).PostAsJsonAsync(BASE_URL, request, TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await response.Content.ReadFromJsonAsync<EventResponse>(TestContext.Current.CancellationToken);
        created.Should().NotBeNull();
        return created;
    }

    private static async Task<string?> CodeOf(HttpResponseMessage response)
    {
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(TestContext.Current.CancellationToken);
        return body.TryGetProperty("code", out var code) ? code.GetString() : null;
    }

    [Fact]
    public async Task Create_Unauthenticated_Is401()
    {
        var response = await _factory.CreateClient().PostAsJsonAsync(BASE_URL, Request(), TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Preview_OfAnOpenEvent_IsServedWithoutSignInAndNamesNobody()
    {
        var created = await CreateAsync(NaturElskaren, Request());

        var response = await _factory.CreateClient().GetAsync($"{BASE_URL}/{created.Identifier}/preview", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.Should().Contain("Kvällsvandring");
        body.Should().NotContain("NaturElskaren");
    }

    [Fact]
    public async Task Preview_OfAPrivateEvent_Is404()
    {
        var created = await CreateAsync(NaturElskaren, Request("Private"));

        var response = await _factory.CreateClient().GetAsync($"{BASE_URL}/{created.Identifier}/preview", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Preview_OfACancelledEvent_Is404()
    {
        var created = await CreateAsync(NaturElskaren, Request());
        var cancelled = await Client(NaturElskaren).PostAsync($"{BASE_URL}/{created.Identifier}/cancel", null, TestContext.Current.CancellationToken);
        cancelled.IsSuccessStatusCode.Should().BeTrue();

        var response = await _factory.CreateClient().GetAsync($"{BASE_URL}/{created.Identifier}/preview", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Create_ThenGet_RoundTripsTheMeetingPointAndRole()
    {
        var created = await CreateAsync(NaturElskaren, Request());

        var fetched = await Client(NaturElskaren).GetFromJsonAsync<EventResponse>($"{BASE_URL}/{created.Identifier}", TestContext.Current.CancellationToken);

        fetched.Should().NotBeNull();
        fetched.MeetingPointLongitude.Should().Be(12.94m);
        fetched.MeetingPointLatitude.Should().Be(57.72m);
        fetched.MyRole.Should().Be("Organizer");
        fetched.OrganizerNickName.Should().Be("NaturElskaren");
        fetched.Permissions.CanEdit.Should().BeTrue();
    }

    [Theory]
    [InlineData("Secret", null)]
    [InlineData("Open", 1)]
    public async Task Create_WithAnInvalidRequest_Is400(string visibility, int? maxParticipants)
    {
        var request = Request(visibility);
        request.MaxParticipants = maxParticipants;

        var response = await Client(NaturElskaren).PostAsJsonAsync(BASE_URL, request, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Feed_NearATrailEvent_FindsItWithItsDistance()
    {
        await CreateAsync(NaturElskaren, Request(trail: Tiveden));

        var page = await Client(VandrarVennen).GetFromJsonAsync<EventPageResponse>(
            $"{BASE_URL}?lat=57.6214&lon=12.8055&radiusKm=1", TestContext.Current.CancellationToken);
        var farAway = await Client(VandrarVennen).GetFromJsonAsync<EventPageResponse>(
            $"{BASE_URL}?lat=59.33&lon=18.07&radiusKm=50", TestContext.Current.CancellationToken);

        page.Should().NotBeNull();
        page.Items.Should().ContainSingle().Which.DistanceMeters.Should().BeLessThan(50);
        page.Items.Single().PlaceName.Should().Be("Tiveden");
        farAway.Should().NotBeNull();
        farAway.Items.Should().BeEmpty();
    }

    [Fact]
    public async Task Feed_WithRadiusButNoPosition_Is400()
    {
        var response = await Client(VandrarVennen).GetAsync($"{BASE_URL}?radiusKm=10", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Mine_ListsThePrivateEventIArrange()
    {
        var created = await CreateAsync(NaturElskaren, Request("Private"));

        var mine = await Client(NaturElskaren).GetFromJsonAsync<EventPageResponse>($"{BASE_URL}/mine", TestContext.Current.CancellationToken);
        var feed = await Client(VandrarVennen).GetFromJsonAsync<EventPageResponse>(BASE_URL, TestContext.Current.CancellationToken);

        mine.Should().NotBeNull();
        mine.Items.Should().ContainSingle().Which.Identifier.Should().Be(created.Identifier);
        feed.Should().NotBeNull();
        feed.Items.Should().BeEmpty();
    }

    [Fact]
    public async Task Get_APrivateEventIAmNotIn_Is404WithEventGone()
    {
        var created = await CreateAsync(NaturElskaren, Request("Private"));

        var response = await Client(VandrarVennen).GetAsync($"{BASE_URL}/{created.Identifier}", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await CodeOf(response)).Should().Be("event_gone");
    }

    [Fact]
    public async Task ACodedError_IsProblemDetailsWithTheCodeAsAnExtension()
    {
        var response = await Client(VandrarVennen).GetAsync($"{BASE_URL}/no-such-event", TestContext.Current.CancellationToken);

        response.Content.Headers.ContentType?.MediaType.Should().Be("application/problem+json");
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(TestContext.Current.CancellationToken);
        body.GetProperty("status").GetInt32().Should().Be(404);
        body.GetProperty("detail").GetString().Should().NotBeNullOrEmpty();
        body.GetProperty("code").GetString().Should().Be("event_gone");
    }

    [Fact]
    public async Task Update_BySomeoneOutsideTheHosts_Is403WithNotAllowed()
    {
        var created = await CreateAsync(NaturElskaren, Request());
        var update = new UpdateEventRequest
        {
            Title = "Kapad",
            Description = "x",
            MeetingPointLongitude = 12.94m,
            MeetingPointLatitude = 57.72m,
            StartsAt = created.StartsAt,
        };

        var response = await Client(VandrarVennen).PutAsJsonAsync($"{BASE_URL}/{created.Identifier}", update, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await CodeOf(response)).Should().Be("not_allowed");
    }

    [Fact]
    public async Task Cancel_Twice_IsNoContentThen409EventCancelled()
    {
        var created = await CreateAsync(NaturElskaren, Request());
        var client = Client(NaturElskaren);

        var first = await client.PostAsync($"{BASE_URL}/{created.Identifier}/cancel", null, TestContext.Current.CancellationToken);
        var second = await client.PostAsync($"{BASE_URL}/{created.Identifier}/cancel", null, TestContext.Current.CancellationToken);

        first.StatusCode.Should().Be(HttpStatusCode.NoContent);
        second.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await CodeOf(second)).Should().Be("event_cancelled");
    }

    [Fact]
    public async Task Create_WithBothATrailAndAHike_Is400()
    {
        var request = Request(trail: Tiveden);
        request.HikeIdentifier = "any-hike";

        var response = await Client(NaturElskaren).PostAsJsonAsync(BASE_URL, request, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Create_WithADeadlineAlreadyPast_Is400()
    {
        var request = Request();
        request.RegistrationDeadline = DateTime.UtcNow.AddHours(-1);

        var response = await Client(NaturElskaren).PostAsJsonAsync(BASE_URL, request, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).Should().Contain("RegistrationDeadline");
    }

    [Fact]
    public async Task Create_FromOwnHike_StoresAnSrid4326RouteThatGoesWithTheEvent()
    {
        var hikeIdentifier = Guid.NewGuid().ToString();
        using (var db = Db())
        {
            var owner = await db.Users.FirstAsync(u => u.NickName == "NaturElskaren", TestContext.Current.CancellationToken);
            db.Hikes.Add(new Hike
            {
                Identifier = hikeIdentifier,
                Name = "Favoritpromenaden",
                GeoPath = GeoPointFactory.FromLonLatPath(
                [
                    new Coordinate(12.940, 57.720),
                    new Coordinate(12.941, 57.721),
                    new Coordinate(12.940, 57.722),
                    new Coordinate(12.941, 57.723),
                ]),
                UserId = owner.Id,
            });
            await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var request = Request();
        request.MeetingPointLongitude = null;
        request.MeetingPointLatitude = null;
        request.HikeIdentifier = hikeIdentifier;
        request.RouteTrimStartIndex = 1;
        var created = await CreateAsync(NaturElskaren, request);

        var fetched = await Client(NaturElskaren).GetFromJsonAsync<EventResponse>($"{BASE_URL}/{created.Identifier}", TestContext.Current.CancellationToken);

        fetched.Should().NotBeNull();
        fetched.Route.Should().NotBeNull();
        fetched.Route.Kind.Should().Be("Own");
        fetched.Route.Coordinates.Should().StartWith("[{\"latitude\":57.721,\"longitude\":12.941}");
        using (var check = Db())
        {
            var stored = await check.EventRoutes.SingleAsync(r => r.Event != null && r.Event.Identifier == created.Identifier, TestContext.Current.CancellationToken);
            stored.Path.SRID.Should().Be(4326);
            stored.Path.NumPoints.Should().Be(3);
        }

        var deleted = await Client(NaturElskaren).DeleteAsync($"{BASE_URL}/{created.Identifier}", TestContext.Current.CancellationToken);

        deleted.StatusCode.Should().Be(HttpStatusCode.NoContent);
        using var after = Db();
        (await after.EventRoutes.AnyAsync(r => r.Event != null && r.Event.Identifier == created.Identifier, TestContext.Current.CancellationToken)).Should().BeFalse();
    }

    [Fact]
    public async Task Delete_RemovesTheEventAndItsRows()
    {
        var created = await CreateAsync(NaturElskaren, Request());
        using (var db = Db())
        {
            var stored = await db.Events.SingleAsync(e => e.Identifier == created.Identifier, TestContext.Current.CancellationToken);
            db.EventParticipants.Add(new EventParticipant { EventId = stored.Id, UserId = 2 });
            db.EventPosts.Add(new EventPost { EventId = stored.Id, UserId = 2, Body = "Hej", ModerationState = ModerationState.HiddenPendingReview });
            await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var response = await Client(NaturElskaren).DeleteAsync($"{BASE_URL}/{created.Identifier}", TestContext.Current.CancellationToken);
        var after = await Client(NaturElskaren).GetAsync($"{BASE_URL}/{created.Identifier}", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        after.StatusCode.Should().Be(HttpStatusCode.NotFound);
        using var check = Db();
        (await check.EventParticipants.CountAsync(TestContext.Current.CancellationToken)).Should().Be(0);
        (await check.EventPosts.IgnoreQueryFilters().CountAsync(TestContext.Current.CancellationToken)).Should().Be(0);
    }
}
