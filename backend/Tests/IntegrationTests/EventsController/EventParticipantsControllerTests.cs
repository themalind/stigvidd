// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using WebDataContracts.RequestModels.Event;
using WebDataContracts.ResponseModels.Event;

namespace IntegrationTests.EventsController;

public class EventParticipantsControllerTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private const string BASE_URL = "/api/v1/events";
    private const string NaturElskaren = "firebase-uid-12345";
    private const string VandrarVennen = "firebase-uid-12346";
    private const string SkogsGreven = "firebase-uid-12347";

    private readonly StigViddWebApplicationFactory<Program> _factory;

    public EventParticipantsControllerTests(StigViddWebApplicationFactory<Program> factory)
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

    private async Task<string> CreateAsync(int? maxParticipants = null)
    {
        var request = new CreateEventRequest
        {
            Title = "Kvällsvandring",
            Description = "Runt sjön",
            Visibility = "Open",
            MeetingPointLongitude = 12.94m,
            MeetingPointLatitude = 57.72m,
            StartsAt = DateTime.UtcNow.AddDays(3),
            MaxParticipants = maxParticipants,
        };

        var response = await Client(NaturElskaren).PostAsJsonAsync(BASE_URL, request, TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await response.Content.ReadFromJsonAsync<EventResponse>(TestContext.Current.CancellationToken);
        created.Should().NotBeNull();
        return created.Identifier;
    }

    private Task<HttpResponseMessage> JoinAsync(string subject, string identifier)
    {
        return Client(subject).PostAsync($"{BASE_URL}/{identifier}/join", null, TestContext.Current.CancellationToken);
    }

    private async Task<string> UserIdentifierAsync(string nickName)
    {
        using var db = Db();
        return (await db.Users.FirstAsync(u => u.NickName == nickName, TestContext.Current.CancellationToken)).Identifier;
    }

    private static async Task<string?> CodeOf(HttpResponseMessage response)
    {
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(TestContext.Current.CancellationToken);
        return body.TryGetProperty("code", out var code) ? code.GetString() : null;
    }

    private async Task CountMatchesJoinedRows(string identifier, int expected)
    {
        using var db = Db();
        var stored = await db.Events.SingleAsync(e => e.Identifier == identifier, TestContext.Current.CancellationToken);
        var joined = await db.EventParticipants.CountAsync(p => p.EventId == stored.Id && p.Status == EventParticipantStatus.Joined, TestContext.Current.CancellationToken);
        stored.ParticipantCount.Should().Be(joined);
        joined.Should().Be(expected);
    }

    [Fact]
    public async Task Join_TakesASpotAndAnswersNoContentTwice()
    {
        var identifier = await CreateAsync();

        var first = await JoinAsync(VandrarVennen, identifier);
        var second = await JoinAsync(VandrarVennen, identifier);

        first.StatusCode.Should().Be(HttpStatusCode.NoContent);
        second.StatusCode.Should().Be(HttpStatusCode.NoContent);
        await CountMatchesJoinedRows(identifier, 2);
    }

    [Fact]
    public async Task Join_AFullEvent_Is409EventFull()
    {
        var identifier = await CreateAsync(maxParticipants: 2);
        await JoinAsync(VandrarVennen, identifier);

        var response = await JoinAsync(SkogsGreven, identifier);

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await CodeOf(response)).Should().Be("event_full");
        await CountMatchesJoinedRows(identifier, 2);
    }

    [Fact]
    public async Task JoinRepository_AFailedInsertThatIsNotARace_IsAnErrorAndGivesTheSpotBack()
    {
        var identifier = await CreateAsync();
        int eventId;
        using (var db = Db())
            eventId = (await db.Events.SingleAsync(e => e.Identifier == identifier, TestContext.Current.CancellationToken)).Id;
        var repository = _factory.Services.GetRequiredService<IEventParticipantRepository>();

        var result = await repository.JoinAsync(eventId, userId: 999_999, DateTime.UtcNow, TestContext.Current.CancellationToken);

        result.Status.Should().Be(RepositoryResultStatus.Error);
        await CountMatchesJoinedRows(identifier, 1);
    }

    [Theory]
    [InlineData("cancelled")]
    [InlineData("reported")]
    [InlineData("past")]
    [InlineData("deadline")]
    public async Task JoinRepository_AnEventClosedSinceTheServiceChecked_TakesNoSpot(string change)
    {
        var identifier = await CreateAsync();
        var ctoken = TestContext.Current.CancellationToken;
        int eventId;
        int userId;
        using (var db = Db())
        {
            var stored = await db.Events.SingleAsync(e => e.Identifier == identifier, ctoken);
            eventId = stored.Id;
            userId = (await db.Users.FirstAsync(u => u.NickName == "VandrarVennen", ctoken)).Id;

            switch (change)
            {
                case "cancelled":
                    stored.Status = EventStatus.Cancelled;
                    break;
                case "reported":
                    stored.ModerationState = ModerationState.HiddenPendingReview;
                    break;
                case "past":
                    stored.PastAfter = DateTime.UtcNow.AddMinutes(-1);
                    break;
                case "deadline":
                    stored.RegistrationDeadline = DateTime.UtcNow.AddMinutes(-1);
                    break;
            }

            await db.SaveChangesAsync(ctoken);
        }
        var repository = _factory.Services.GetRequiredService<IEventParticipantRepository>();

        var result = await repository.JoinAsync(eventId, userId, DateTime.UtcNow, ctoken);

        result.Status.Should().Be(RepositoryResultStatus.Conflict);
        await CountMatchesJoinedRows(identifier, 1);
    }

    [Fact]
    public async Task Interested_ThenJoin_TurnsTheRowIntoAJoinedOne()
    {
        var identifier = await CreateAsync();

        var interested = await Client(VandrarVennen).PostAsync($"{BASE_URL}/{identifier}/interested", null, TestContext.Current.CancellationToken);
        await CountMatchesJoinedRows(identifier, 1);
        var joined = await JoinAsync(VandrarVennen, identifier);

        interested.StatusCode.Should().Be(HttpStatusCode.NoContent);
        joined.StatusCode.Should().Be(HttpStatusCode.NoContent);
        await CountMatchesJoinedRows(identifier, 2);
        using var db = Db();
        (await db.EventParticipants.CountAsync(p => p.Event != null && p.Event.Identifier == identifier && p.Status == EventParticipantStatus.Interested, TestContext.Current.CancellationToken)).Should().Be(0);
    }

    [Fact]
    public async Task Leave_FreesTheSpot()
    {
        var identifier = await CreateAsync(maxParticipants: 2);
        await JoinAsync(VandrarVennen, identifier);

        var left = await Client(VandrarVennen).DeleteAsync($"{BASE_URL}/{identifier}/leave", TestContext.Current.CancellationToken);
        var joined = await JoinAsync(SkogsGreven, identifier);

        left.StatusCode.Should().Be(HttpStatusCode.NoContent);
        joined.StatusCode.Should().Be(HttpStatusCode.NoContent);
        await CountMatchesJoinedRows(identifier, 2);
    }

    [Fact]
    public async Task Leave_ThenRejoin_IsAllowedOnAnOpenEvent()
    {
        var identifier = await CreateAsync();
        await JoinAsync(VandrarVennen, identifier);

        var left = await Client(VandrarVennen).DeleteAsync($"{BASE_URL}/{identifier}/leave", TestContext.Current.CancellationToken);
        var rejoined = await JoinAsync(VandrarVennen, identifier);

        left.StatusCode.Should().Be(HttpStatusCode.NoContent);
        rejoined.StatusCode.Should().Be(HttpStatusCode.NoContent);
        await CountMatchesJoinedRows(identifier, 2);
    }

    [Fact]
    public async Task Remove_ThenRejoin_Is409RemovedFromEvent()
    {
        var identifier = await CreateAsync();
        await JoinAsync(VandrarVennen, identifier);
        var vandrarVennen = await UserIdentifierAsync("VandrarVennen");

        var removed = await Client(NaturElskaren).DeleteAsync($"{BASE_URL}/{identifier}/participants/{vandrarVennen}", TestContext.Current.CancellationToken);
        var rejoin = await JoinAsync(VandrarVennen, identifier);

        removed.StatusCode.Should().Be(HttpStatusCode.NoContent);
        rejoin.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await CodeOf(rejoin)).Should().Be("removed_from_event");
        await CountMatchesJoinedRows(identifier, 1);
    }

    [Fact]
    public async Task Participants_ListForAParticipant_CountsForAnOutsider()
    {
        var identifier = await CreateAsync();
        await JoinAsync(VandrarVennen, identifier);

        var inside = await Client(VandrarVennen).GetFromJsonAsync<EventParticipantsResponse>($"{BASE_URL}/{identifier}/participants", TestContext.Current.CancellationToken);
        var outside = await Client(SkogsGreven).GetFromJsonAsync<EventParticipantsResponse>($"{BASE_URL}/{identifier}/participants", TestContext.Current.CancellationToken);

        inside.Should().NotBeNull();
        inside.Participants.Should().NotBeNull();
        inside.Participants.Select(p => p.NickName).Should().Equal("NaturElskaren", "VandrarVennen");
        outside.Should().NotBeNull();
        outside.ParticipantCount.Should().Be(2);
        outside.Participants.Should().BeNull();
    }

    [Fact]
    public async Task Role_WithAnUnknownRole_Is400()
    {
        var identifier = await CreateAsync();
        await JoinAsync(VandrarVennen, identifier);
        var vandrarVennen = await UserIdentifierAsync("VandrarVennen");

        var response = await Client(NaturElskaren).PutAsJsonAsync(
            $"{BASE_URL}/{identifier}/participants/{vandrarVennen}/role",
            new EventRoleRequest { Role = "Organizer" },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Role_PromoteThenTheCoHostEdits()
    {
        var identifier = await CreateAsync();
        await JoinAsync(VandrarVennen, identifier);
        var vandrarVennen = await UserIdentifierAsync("VandrarVennen");

        var promoted = await Client(NaturElskaren).PutAsJsonAsync(
            $"{BASE_URL}/{identifier}/participants/{vandrarVennen}/role",
            new EventRoleRequest { Role = "CoHost" },
            TestContext.Current.CancellationToken);
        var seen = await Client(VandrarVennen).GetFromJsonAsync<EventResponse>($"{BASE_URL}/{identifier}", TestContext.Current.CancellationToken);

        promoted.StatusCode.Should().Be(HttpStatusCode.NoContent);
        seen.Should().NotBeNull();
        seen.MyRole.Should().Be("CoHost");
        seen.Permissions.CanEdit.Should().BeTrue();
    }

    [Fact]
    public async Task Mute_SavesTheSetting()
    {
        var identifier = await CreateAsync();
        await JoinAsync(VandrarVennen, identifier);

        var response = await Client(VandrarVennen).PutAsJsonAsync($"{BASE_URL}/{identifier}/mute", new EventMuteRequest { Muted = true }, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        using var db = Db();
        (await db.EventParticipants.SingleAsync(p => p.Event != null && p.Event.Identifier == identifier && p.UserId == 2, TestContext.Current.CancellationToken))
            .MutePosts.Should().BeTrue();
    }
}
