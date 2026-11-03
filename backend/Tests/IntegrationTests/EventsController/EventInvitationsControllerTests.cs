// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
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

public class EventInvitationsControllerTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private const string BASE_URL = "/api/v1/events";
    private const string NaturElskaren = "firebase-uid-12345";
    private const string VandrarVennen = "firebase-uid-12346";
    private const string SkogsGreven = "firebase-uid-12347";

    private readonly StigViddWebApplicationFactory<Program> _factory;

    public EventInvitationsControllerTests(StigViddWebApplicationFactory<Program> factory)
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

    private async Task<string> CreateAsync(string visibility)
    {
        var request = new CreateEventRequest
        {
            Title = "Kvällsvandring",
            Description = "Runt sjön",
            Visibility = visibility,
            MeetingPointLongitude = 12.94m,
            MeetingPointLatitude = 57.72m,
            StartsAt = DateTime.UtcNow.AddDays(3),
        };

        var response = await Client(NaturElskaren).PostAsJsonAsync(BASE_URL, request, TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await response.Content.ReadFromJsonAsync<EventResponse>(TestContext.Current.CancellationToken);
        created.Should().NotBeNull();
        return created.Identifier;
    }

    private Task<HttpResponseMessage> InviteAsync(string identifier, params string[] nickNames)
    {
        return Client(NaturElskaren).PostAsJsonAsync(
            $"{BASE_URL}/{identifier}/invite",
            new EventInviteRequest { NickNames = nickNames.ToList() },
            TestContext.Current.CancellationToken);
    }

    private Task<HttpResponseMessage> AcceptAsync(string subject, string identifier)
    {
        return Client(subject).PostAsync($"{BASE_URL}/invitations/{identifier}/accept", null, TestContext.Current.CancellationToken);
    }

    private async Task<List<EventInvitationResponse>> PendingAsync(string subject)
    {
        var response = await Client(subject).GetAsync($"{BASE_URL}/invitations", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var pending = await response.Content.ReadFromJsonAsync<List<EventInvitationResponse>>(TestContext.Current.CancellationToken);
        pending.Should().NotBeNull();
        return pending;
    }

    private async Task<EventInvitationStatus?> StatusOfAsync(string identifier, string nickName)
    {
        using var db = Db();
        return await db.EventInvitations
            .Where(i => i.Event != null && i.Event.Identifier == identifier && i.InvitedUser != null && i.InvitedUser.NickName == nickName)
            .Select(i => (EventInvitationStatus?)i.Status)
            .FirstOrDefaultAsync(TestContext.Current.CancellationToken);
    }

    private async Task<int> ParticipantCountAsync(string identifier)
    {
        using var db = Db();
        return (await db.Events.SingleAsync(e => e.Identifier == identifier, TestContext.Current.CancellationToken)).ParticipantCount;
    }

    private static async Task<JsonElement> BodyOf(HttpResponseMessage response)
    {
        return await response.Content.ReadFromJsonAsync<JsonElement>(TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task Invite_ThenAccept_JoinsAPrivateEvent_AndASecondAcceptIsNoContent()
    {
        var identifier = await CreateAsync("Private");

        var invited = await InviteAsync(identifier, "VandrarVennen");
        var pending = await PendingAsync(VandrarVennen);
        var accepted = await AcceptAsync(VandrarVennen, identifier);
        var again = await AcceptAsync(VandrarVennen, identifier);

        invited.StatusCode.Should().Be(HttpStatusCode.NoContent);
        pending.Should().ContainSingle();
        pending[0].Event.Identifier.Should().Be(identifier);
        pending[0].InvitedByNickName.Should().Be("NaturElskaren");
        accepted.StatusCode.Should().Be(HttpStatusCode.NoContent);
        again.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await ParticipantCountAsync(identifier)).Should().Be(2);
        (await StatusOfAsync(identifier, "VandrarVennen")).Should().Be(EventInvitationStatus.Accepted);
        (await PendingAsync(VandrarVennen)).Should().BeEmpty();
    }

    [Fact]
    public async Task Accept_WithoutAnInvitation_Is404InvitationGone()
    {
        var identifier = await CreateAsync("Open");

        var response = await AcceptAsync(VandrarVennen, identifier);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await BodyOf(response)).GetProperty("code").GetString().Should().Be("invitation_gone");
        (await ParticipantCountAsync(identifier)).Should().Be(1);
    }

    [Fact]
    public async Task Accept_AnInvitationToAnEventReportedSince_StillJoins()
    {
        var identifier = await CreateAsync("Private");
        await InviteAsync(identifier, "VandrarVennen");
        using (var db = Db())
        {
            var stored = await db.Events.SingleAsync(e => e.Identifier == identifier, TestContext.Current.CancellationToken);
            stored.ModerationState = ModerationState.HiddenPendingReview;
            await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var response = await AcceptAsync(VandrarVennen, identifier);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await ParticipantCountAsync(identifier)).Should().Be(2);
    }

    [Fact]
    public async Task Join_AnOpenEventWithAPendingInvitation_MarksTheInvitationAccepted()
    {
        var identifier = await CreateAsync("Open");
        await InviteAsync(identifier, "VandrarVennen");

        var response = await Client(VandrarVennen).PostAsync($"{BASE_URL}/{identifier}/join", null, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await StatusOfAsync(identifier, "VandrarVennen")).Should().Be(EventInvitationStatus.Accepted);
    }

    [Fact]
    public async Task Invite_WithAnUnknownNickname_Is404NamingIt_AndInvitesNobody()
    {
        var identifier = await CreateAsync("Open");

        var response = await InviteAsync(identifier, "VandrarVennen", "FinnsInte");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        var body = await BodyOf(response);
        body.GetProperty("code").GetString().Should().Be("unknown_nicknames");
        body.GetProperty("nickNames").EnumerateArray().Select(n => n.GetString()).Should().Equal("FinnsInte");
        (await StatusOfAsync(identifier, "VandrarVennen")).Should().BeNull();
    }

    [Fact]
    public async Task Decline_RemovesItFromTheList_AndTheHostCanInviteAgain()
    {
        var identifier = await CreateAsync("Private");
        await InviteAsync(identifier, "VandrarVennen");

        var declined = await Client(VandrarVennen).DeleteAsync($"{BASE_URL}/invitations/{identifier}", TestContext.Current.CancellationToken);
        var afterDecline = await PendingAsync(VandrarVennen);
        var reinvited = await InviteAsync(identifier, "VandrarVennen");

        declined.StatusCode.Should().Be(HttpStatusCode.NoContent);
        afterDecline.Should().BeEmpty();
        reinvited.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await PendingAsync(VandrarVennen)).Should().ContainSingle();
    }

    [Fact]
    public async Task Leave_APrivateEvent_HidesItAndRefusesAJoin_UntilANewInvitationIsAccepted()
    {
        var identifier = await CreateAsync("Private");
        await InviteAsync(identifier, "VandrarVennen");
        await AcceptAsync(VandrarVennen, identifier);

        var left = await Client(VandrarVennen).DeleteAsync($"{BASE_URL}/{identifier}/leave", TestContext.Current.CancellationToken);
        var view = await Client(VandrarVennen).GetAsync($"{BASE_URL}/{identifier}", TestContext.Current.CancellationToken);
        var join = await Client(VandrarVennen).PostAsync($"{BASE_URL}/{identifier}/join", null, TestContext.Current.CancellationToken);
        var oldInvitation = await AcceptAsync(VandrarVennen, identifier);

        left.StatusCode.Should().Be(HttpStatusCode.NoContent);
        view.StatusCode.Should().Be(HttpStatusCode.NotFound);
        join.IsSuccessStatusCode.Should().BeFalse();
        oldInvitation.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await ParticipantCountAsync(identifier)).Should().Be(1);

        var reinvited = await InviteAsync(identifier, "VandrarVennen");
        var accepted = await AcceptAsync(VandrarVennen, identifier);

        reinvited.StatusCode.Should().Be(HttpStatusCode.NoContent);
        accepted.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await ParticipantCountAsync(identifier)).Should().Be(2);
    }

    [Fact]
    public async Task Revoke_ByTheHost_TakesTheInvitationBack_ButNotByAnOutsider()
    {
        var identifier = await CreateAsync("Open");
        await InviteAsync(identifier, "VandrarVennen");
        string invitee;
        using (var db = Db())
            invitee = (await db.Users.FirstAsync(u => u.NickName == "VandrarVennen", TestContext.Current.CancellationToken)).Identifier;

        var byOutsider = await Client(SkogsGreven).DeleteAsync($"{BASE_URL}/{identifier}/invitations/{invitee}", TestContext.Current.CancellationToken);
        var stillPending = await PendingAsync(VandrarVennen);
        var byHost = await Client(NaturElskaren).DeleteAsync($"{BASE_URL}/{identifier}/invitations/{invitee}", TestContext.Current.CancellationToken);

        byOutsider.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        stillPending.Should().ContainSingle();
        byHost.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await PendingAsync(VandrarVennen)).Should().BeEmpty();
    }
}
