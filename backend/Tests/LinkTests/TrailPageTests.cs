// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Net;
using AwesomeAssertions;

namespace LinkTests;

public class TrailPageTests
{
    private static object Trail(string name = "Sjöleden", object[]? images = null) => new
    {
        identifier = "trail-1",
        name,
        trailLength = 4.2m,
        city = "Borås",
        description = "En lugn runda längs sjön.",
        trailImagesResponse = images ?? [new { identifier = "img-1", imageUrl = "https://media.example.test/a.webp", altText = "Sjön" }],
    };

    private static async Task<(HttpResponseMessage Response, string Html)> GetAsync(LinkServiceFactory factory, string path)
    {
        var response = await factory.CreateClient().GetAsync(path, TestContext.Current.CancellationToken);
        var html = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        return (response, html);
    }

    [Fact]
    public async Task A_found_trail_renders_its_name_facts_and_description()
    {
        using var factory = new LinkServiceFactory();
        factory.Api.Returns(Trail());

        var (response, html) = await GetAsync(factory, "/trail/trail-1");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Content.Headers.ContentType?.MediaType.Should().Be("text/html");
        html.Should().Contain("<h1>Sjöleden</h1>");
        html.Should().Contain("4,2 km · Borås");
        html.Should().Contain("En lugn runda längs sjön.");
    }

    [Fact]
    public async Task A_found_trail_carries_preview_tags_and_a_canonical_link()
    {
        using var factory = new LinkServiceFactory();
        factory.Api.Returns(Trail());

        var (_, html) = await GetAsync(factory, "/trail/trail-1");

        html.Should().Contain("<meta property=\"og:title\" content=\"Sjöleden\"");
        html.Should().Contain("<meta property=\"og:image\" content=\"https://media.example.test/a.webp\"");
        html.Should().Contain("<link rel=\"canonical\" href=\"https://link.example.test/trail/trail-1\"");
    }

    [Fact]
    public async Task A_trail_without_images_falls_back_to_the_site_icon_for_the_preview()
    {
        using var factory = new LinkServiceFactory();
        factory.Api.Returns(Trail(images: []));

        var (_, html) = await GetAsync(factory, "/trail/trail-1");

        html.Should().Contain("<meta property=\"og:image\" content=\"https://example.test/icon.png\"");
        html.Should().NotContain("class=\"hero\"");
    }

    [Fact]
    public async Task The_open_in_app_button_uses_the_custom_scheme()
    {
        using var factory = new LinkServiceFactory();
        factory.Api.Returns(Trail());

        var (_, html) = await GetAsync(factory, "/trail/trail-1");

        html.Should().Contain("href=\"stigvidd://trail/trail-1\"");
    }

    [Fact]
    public async Task User_written_trail_names_are_html_encoded()
    {
        using var factory = new LinkServiceFactory();
        factory.Api.Returns(Trail(name: "<script>alert(1)</script>\" onload=\"x"));

        var (_, html) = await GetAsync(factory, "/trail/trail-1");

        html.Should().NotContain("<script>alert(1)</script>");
        html.Should().NotContain("\" onload=\"x");
        html.Should().Contain("&lt;script&gt;alert(1)&lt;/script&gt;");
    }

    [Fact]
    public async Task Store_buttons_are_hidden_until_their_urls_are_configured()
    {
        using var factory = new LinkServiceFactory();
        factory.Api.Returns(Trail());

        var (_, html) = await GetAsync(factory, "/trail/trail-1");

        html.Should().NotContain("App Store");
        html.Should().NotContain("Google Play");
    }

    [Fact]
    public async Task The_app_store_button_links_to_the_configured_url()
    {
        using var factory = new LinkServiceFactory().With("AppLinks:AppStoreUrl", "https://apps.apple.com/se/app/id123");
        factory.Api.Returns(Trail());

        var (_, html) = await GetAsync(factory, "/trail/trail-1");

        html.Should().Contain("href=\"https://apps.apple.com/se/app/id123\"");
        html.Should().NotContain("Google Play");
    }

    [Fact]
    public async Task A_found_trail_may_be_cached_briefly()
    {
        using var factory = new LinkServiceFactory();
        factory.Api.Returns(Trail());

        var (response, _) = await GetAsync(factory, "/trail/trail-1");

        response.Headers.CacheControl?.ToString().Should().Be("public, max-age=300");
    }

    [Fact]
    public async Task The_identifier_is_escaped_into_the_api_request()
    {
        using var factory = new LinkServiceFactory();
        factory.Api.Returns(Trail());

        await GetAsync(factory, "/trail/a%3Fb");

        factory.Api.Requests.Should().ContainSingle()
            .Which.AbsolutePath.Should().Be("/api/v1/Trails/a%3Fb");
    }

    [Fact]
    public async Task An_unknown_trail_is_a_404_page()
    {
        using var factory = new LinkServiceFactory();
        factory.Api.Returns(HttpStatusCode.NotFound);

        var (response, html) = await GetAsync(factory, "/trail/missing");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        html.Should().Contain("Leden finns inte");
        response.Headers.CacheControl?.NoStore.Should().BeTrue();
    }

    [Fact]
    public async Task An_api_error_is_a_503_page()
    {
        using var factory = new LinkServiceFactory();
        factory.Api.Returns(HttpStatusCode.InternalServerError);

        var (response, html) = await GetAsync(factory, "/trail/trail-1");

        response.StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable);
        html.Should().Contain("Något gick fel");
    }

    [Fact]
    public async Task An_unreachable_api_is_a_503_page()
    {
        using var factory = new LinkServiceFactory();
        factory.Api.Throws(new HttpRequestException("connection refused"));

        var (response, html) = await GetAsync(factory, "/trail/trail-1");

        response.StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable);
        html.Should().Contain("Något gick fel");
    }

    [Fact]
    public async Task Any_other_path_redirects_to_the_site()
    {
        using var factory = new LinkServiceFactory();

        var response = await factory.CreateNonRedirectingClient().GetAsync("/something", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Redirect);
        response.Headers.Location.Should().Be(new Uri("https://example.test"));
    }
}
