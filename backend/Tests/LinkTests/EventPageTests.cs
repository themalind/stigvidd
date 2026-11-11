// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Net;
using AwesomeAssertions;

namespace LinkTests;

public class EventPageTests
{
    private static object Event(string title = "Kvällsvandring")
    {
        return new
        {
            identifier = "event-1",
            title,
            startsAt = new DateTime(2026, 11, 5, 16, 30, 0, DateTimeKind.Utc),
            placeName = "Rya åsar",
            participantCount = 3,
            maxParticipants = 8,
            imageUrl = "https://media.example.test/e.webp",
        };
    }

    private static async Task<(HttpResponseMessage Response, string Html)> GetAsync(LinkServiceFactory factory, string path)
    {
        var response = await factory.CreateClient().GetAsync(path, TestContext.Current.CancellationToken);
        var html = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        return (response, html);
    }

    [Fact]
    public async Task A_found_event_renders_its_title_place_spots_and_stockholm_time()
    {
        using var factory = new LinkServiceFactory();
        factory.Api.Returns(Event());

        var (response, html) = await GetAsync(factory, "/event/event-1");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        html.Should().Contain("<h1>Kvällsvandring</h1>");
        html.Should().Contain("Rya åsar");
        html.Should().Contain("3 av 8 platser tagna");
        html.Should().Contain("kl. 17:30");
        factory.Api.Requests.Should().ContainSingle().Which.AbsolutePath.Should().Be("/api/v1/Events/event-1/preview");
    }

    [Fact]
    public async Task The_cover_is_shown_in_the_same_2_to_1_strip_as_in_the_app()
    {
        using var factory = new LinkServiceFactory();
        factory.Api.Returns(Event());

        var (_, html) = await GetAsync(factory, "/event/event-1");

        html.Should().Contain("<img class=\"hero cover\" src=\"https://media.example.test/e.webp\"");
        html.Should().Contain(".hero.cover { aspect-ratio: 2 / 1; }");
    }

    [Fact]
    public async Task The_open_in_app_button_uses_the_custom_scheme_with_the_event_path()
    {
        using var factory = new LinkServiceFactory();
        factory.Api.Returns(Event());

        var (_, html) = await GetAsync(factory, "/event/event-1");

        html.Should().Contain("href=\"stigvidd://event/event-1\"");
        html.Should().Contain("<link rel=\"canonical\" href=\"https://link.example.test/event/event-1\"");
    }

    [Fact]
    public async Task User_written_titles_are_html_encoded()
    {
        using var factory = new LinkServiceFactory();
        factory.Api.Returns(Event("<script>alert(1)</script>"));

        var (_, html) = await GetAsync(factory, "/event/event-1");

        html.Should().NotContain("<script>alert(1)</script>");
    }

    [Fact]
    public async Task A_missing_or_private_event_is_a_404_page()
    {
        using var factory = new LinkServiceFactory();
        factory.Api.Returns(HttpStatusCode.NotFound);

        var (response, html) = await GetAsync(factory, "/event/event-1");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        html.Should().Contain("Evenemanget finns inte");
    }

    [Fact]
    public async Task An_unreachable_api_is_a_503_page()
    {
        using var factory = new LinkServiceFactory();
        factory.Api.Returns(HttpStatusCode.InternalServerError);

        var (response, _) = await GetAsync(factory, "/event/event-1");

        response.StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable);
    }
}
