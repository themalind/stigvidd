// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Infrastructure.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using WebDataContracts.RequestModels.Event;
using WebDataContracts.ResponseModels.Event;

namespace IntegrationTests.EventsController;

// The rate limiter lives as long as the host, so every test here shares it; a limit this high keeps them independent. keep-comment: why these tests get their own factory
public class BoardWebApplicationFactory : StigViddWebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.ConfigureAppConfiguration(config => config.AddInMemoryCollection(new Dictionary<string, string?> { ["Events:PostsPerMinute"] = "1000" }));
    }
}

public class PostRateLimitWebApplicationFactory : StigViddWebApplicationFactory<Program>
{
    public const int PostsPerMinute = 2;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.ConfigureAppConfiguration(config => config.AddInMemoryCollection(new Dictionary<string, string?> { ["Events:PostsPerMinute"] = $"{PostsPerMinute}" }));
    }
}

internal static class BoardRequests
{
    public const string BASE_URL = "/api/v1/events";
    public const string NaturElskaren = "firebase-uid-12345";
    public const string VandrarVennen = "firebase-uid-12346";
    public const string SkogsGreven = "firebase-uid-12347";

    public static HttpClient Client(StigViddWebApplicationFactory<Program> factory, string subject)
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", subject);
        return client;
    }

    // NaturElskaren organizes, VandrarVennen has joined. keep-comment: the board every test starts from
    public static async Task<string> CreateBoardAsync(StigViddWebApplicationFactory<Program> factory)
    {
        var request = new CreateEventRequest
        {
            Title = "Kvällsvandring",
            Description = "Runt sjön",
            Visibility = "Open",
            MeetingPointLongitude = 12.94m,
            MeetingPointLatitude = 57.72m,
            StartsAt = DateTime.UtcNow.AddDays(3),
        };

        var response = await Client(factory, NaturElskaren).PostAsJsonAsync(BASE_URL, request, TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await response.Content.ReadFromJsonAsync<EventResponse>(TestContext.Current.CancellationToken);
        created.Should().NotBeNull();

        var joined = await Client(factory, VandrarVennen).PostAsync($"{BASE_URL}/{created.Identifier}/join", null, TestContext.Current.CancellationToken);
        joined.StatusCode.Should().Be(HttpStatusCode.NoContent);

        return created.Identifier;
    }

    public static Task<HttpResponseMessage> PostAsync(StigViddWebApplicationFactory<Program> factory, string subject, string identifier, string body)
    {
        return Client(factory, subject).PostAsJsonAsync($"{BASE_URL}/{identifier}/posts", new EventPostRequest { Body = body }, TestContext.Current.CancellationToken);
    }

    public static async Task<string?> CodeOf(HttpResponseMessage response)
    {
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(TestContext.Current.CancellationToken);
        return body.TryGetProperty("code", out var code) ? code.GetString() : null;
    }
}

public class EventPostsControllerTests : IClassFixture<BoardWebApplicationFactory>
{
    private readonly BoardWebApplicationFactory _factory;

    public EventPostsControllerTests(BoardWebApplicationFactory factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    private HttpClient Client(string subject)
    {
        return BoardRequests.Client(_factory, subject);
    }

    private async Task<EventPostResponse> PostAsync(string subject, string identifier, string body)
    {
        var response = await BoardRequests.PostAsync(_factory, subject, identifier, body);
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var post = await response.Content.ReadFromJsonAsync<EventPostResponse>(TestContext.Current.CancellationToken);
        post.Should().NotBeNull();
        return post;
    }

    private async Task<EventBoardResponse> BoardAsync(string subject, string identifier)
    {
        var response = await Client(subject).GetAsync($"{BoardRequests.BASE_URL}/{identifier}/posts", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var board = await response.Content.ReadFromJsonAsync<EventBoardResponse>(TestContext.Current.CancellationToken);
        board.Should().NotBeNull();
        return board;
    }

    [Fact]
    public async Task Post_ThenGetPosts_ShowsThePostToTheOtherParticipants()
    {
        var identifier = await BoardRequests.CreateBoardAsync(_factory);

        var post = await PostAsync(BoardRequests.VandrarVennen, identifier, "Vi ses vid parkeringen!");
        var board = await BoardAsync(BoardRequests.NaturElskaren, identifier);

        board.Posts.Should().ContainSingle(p => p.Identifier == post.Identifier);
        var seen = board.Posts.Single();
        seen.AuthorNickName.Should().Be("VandrarVennen");
        seen.IsMine.Should().BeFalse();
        seen.CanDelete.Should().BeTrue();
        board.LastReadPostAt.Should().BeNull();
    }

    [Fact]
    public async Task Post_BySomeoneWhoHasNotJoined_Is403NotAllowed()
    {
        var identifier = await BoardRequests.CreateBoardAsync(_factory);

        var response = await BoardRequests.PostAsync(_factory, BoardRequests.SkogsGreven, identifier, "Hej!");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await BoardRequests.CodeOf(response)).Should().Be("not_allowed");
    }

    [Fact]
    public async Task Post_WithOnlyWhitespace_Is400()
    {
        var identifier = await BoardRequests.CreateBoardAsync(_factory);

        var response = await BoardRequests.PostAsync(_factory, BoardRequests.VandrarVennen, identifier, "   ");

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task MarkRead_MovesTheMarkerTheBoardReturns()
    {
        var identifier = await BoardRequests.CreateBoardAsync(_factory);
        var post = await PostAsync(BoardRequests.NaturElskaren, identifier, "Hej!");

        var response = await Client(BoardRequests.VandrarVennen).PutAsJsonAsync(
            $"{BoardRequests.BASE_URL}/{identifier}/posts/read",
            new EventPostsReadRequest { ReadUpTo = post.CreatedAt },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await BoardAsync(BoardRequests.VandrarVennen, identifier)).LastReadPostAt.Should().BeCloseTo(post.CreatedAt, TimeSpan.FromMilliseconds(1));
    }

    [Fact]
    public async Task GetEvent_CountsOthersUnreadPostsUntilTheyAreRead()
    {
        var identifier = await BoardRequests.CreateBoardAsync(_factory);
        await PostAsync(BoardRequests.VandrarVennen, identifier, "Mitt eget");
        await PostAsync(BoardRequests.NaturElskaren, identifier, "Hej!");
        var latest = await PostAsync(BoardRequests.NaturElskaren, identifier, "Ta med fika");

        (await EventAsync(BoardRequests.VandrarVennen, identifier)).UnreadPostCount.Should().Be(2);

        await Client(BoardRequests.VandrarVennen).PutAsJsonAsync(
            $"{BoardRequests.BASE_URL}/{identifier}/posts/read",
            new EventPostsReadRequest { ReadUpTo = latest.CreatedAt },
            TestContext.Current.CancellationToken);

        (await EventAsync(BoardRequests.VandrarVennen, identifier)).UnreadPostCount.Should().Be(0);
        (await EventAsync(BoardRequests.SkogsGreven, identifier)).UnreadPostCount.Should().Be(0);
    }

    private async Task<EventResponse> EventAsync(string subject, string identifier)
    {
        var response = await Client(subject).GetAsync($"{BoardRequests.BASE_URL}/{identifier}", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var fetched = await response.Content.ReadFromJsonAsync<EventResponse>(TestContext.Current.CancellationToken);
        fetched.Should().NotBeNull();
        return fetched;
    }

    [Fact]
    public async Task PostRoutes_ReachThePostNotAnEvent()
    {
        var identifier = await BoardRequests.CreateBoardAsync(_factory);
        var post = await PostAsync(BoardRequests.VandrarVennen, identifier, "Hej!");
        var client = Client(BoardRequests.VandrarVennen);

        var edited = await client.PutAsJsonAsync($"{BoardRequests.BASE_URL}/posts/{post.Identifier}", new EventPostRequest { Body = "Hej allihop!" }, TestContext.Current.CancellationToken);
        var deleted = await client.DeleteAsync($"{BoardRequests.BASE_URL}/posts/{post.Identifier}", TestContext.Current.CancellationToken);

        edited.StatusCode.Should().Be(HttpStatusCode.OK);
        var editedPost = await edited.Content.ReadFromJsonAsync<EventPostResponse>(TestContext.Current.CancellationToken);
        editedPost.Should().NotBeNull();
        editedPost.Body.Should().Be("Hej allihop!");
        editedPost.EditedAt.Should().NotBeNull();
        deleted.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await BoardAsync(BoardRequests.VandrarVennen, identifier)).Posts.Should().BeEmpty();

        using var db = _factory.Services.GetRequiredService<IDbContextFactory<StigViddDbContext>>().CreateDbContext();
        (await db.Events.AnyAsync(e => e.Identifier == identifier, TestContext.Current.CancellationToken)).Should().BeTrue();
    }

    [Fact]
    public async Task Pin_ByTheOrganizer_PutsThePostInPinned()
    {
        var identifier = await BoardRequests.CreateBoardAsync(_factory);
        var post = await PostAsync(BoardRequests.VandrarVennen, identifier, "Samåkning från Knalleland");

        var response = await Client(BoardRequests.NaturElskaren).PutAsJsonAsync(
            $"{BoardRequests.BASE_URL}/posts/{post.Identifier}/pin",
            new EventPostPinRequest { Pinned = true },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await BoardAsync(BoardRequests.VandrarVennen, identifier)).Pinned.Should().ContainSingle(p => p.Identifier == post.Identifier);
    }

    [Fact]
    public async Task GetEvent_TellsAJoinedParticipantTheyMayPost()
    {
        var identifier = await BoardRequests.CreateBoardAsync(_factory);

        var joined = await Client(BoardRequests.VandrarVennen).GetFromJsonAsync<EventResponse>($"{BoardRequests.BASE_URL}/{identifier}", TestContext.Current.CancellationToken);
        var outsider = await Client(BoardRequests.SkogsGreven).GetFromJsonAsync<EventResponse>($"{BoardRequests.BASE_URL}/{identifier}", TestContext.Current.CancellationToken);

        joined.Should().NotBeNull();
        outsider.Should().NotBeNull();
        joined.Permissions.CanPost.Should().BeTrue();
        outsider.Permissions.CanPost.Should().BeFalse();
    }
}

public class EventPostRateLimitTests : IClassFixture<PostRateLimitWebApplicationFactory>
{
    private readonly PostRateLimitWebApplicationFactory _factory;

    public EventPostRateLimitTests(PostRateLimitWebApplicationFactory factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    // One test, so no other test in this host spends the same users' buckets first. keep-comment: the limiter outlives each test
    [Fact]
    public async Task Post_OverTheLimit_Is429ForThatUserOnlyAndOnlyForPosting()
    {
        var identifier = await BoardRequests.CreateBoardAsync(_factory);

        for (var i = 0; i < PostRateLimitWebApplicationFactory.PostsPerMinute; i++)
            (await BoardRequests.PostAsync(_factory, BoardRequests.VandrarVennen, identifier, $"Inlägg {i}")).StatusCode.Should().Be(HttpStatusCode.Created);

        var overTheLimit = await BoardRequests.PostAsync(_factory, BoardRequests.VandrarVennen, identifier, "Ett till");
        var anotherUser = await BoardRequests.PostAsync(_factory, BoardRequests.NaturElskaren, identifier, "Hej!");
        var reading = await BoardRequests.Client(_factory, BoardRequests.VandrarVennen)
            .GetAsync($"{BoardRequests.BASE_URL}/{identifier}/posts", TestContext.Current.CancellationToken);

        overTheLimit.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
        (await BoardRequests.CodeOf(overTheLimit)).Should().Be("too_many_posts");
        anotherUser.StatusCode.Should().Be(HttpStatusCode.Created);
        reading.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
