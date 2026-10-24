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

    private const string AndroidUserAgent =
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36";

    private const string IphoneUserAgent =
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

    private static LinkServiceFactory StoreFactory(string playStoreUrl = "") => new LinkServiceFactory()
        .With("AppLinks:AppStoreUrl", "https://apps.apple.com/se/app/id123")
        .With("AppLinks:PlayStoreUrl", playStoreUrl)
        .With("AppLinks:AndroidTestUrl", "https://example.test/#hamta");

    private static async Task<string> GetAsAsync(LinkServiceFactory factory, string path, string userAgent)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, path);
        request.Headers.TryAddWithoutValidation("User-Agent", userAgent);
        var response = await factory.CreateClient().SendAsync(request, TestContext.Current.CancellationToken);
        return await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task Android_visitors_get_the_tester_button_instead_of_the_app_store()
    {
        using var factory = StoreFactory();
        factory.Api.Returns(Trail());

        var html = await GetAsAsync(factory, "/trail/trail-1", AndroidUserAgent);

        html.Should().NotContain("App Store");
        html.Should().Contain("href=\"https://example.test/#hamta\"");
        html.Should().Contain(">Testa på Android</a>");
        html.Should().Contain("Stigvidd finns snart på Google Play.");
        html.Should().Contain("href=\"stigvidd://trail/trail-1\"");
    }

    [Fact]
    public async Task Android_visitors_get_google_play_once_it_is_configured()
    {
        using var factory = StoreFactory(playStoreUrl: "https://play.google.com/store/apps/details?id=x");
        factory.Api.Returns(Trail());

        var html = await GetAsAsync(factory, "/trail/trail-1", AndroidUserAgent);

        html.Should().Contain(">Hämta på Google Play</a>");
        html.Should().NotContain("Testa på Android");
        html.Should().NotContain("App Store");
    }

    [Fact]
    public async Task Iphone_visitors_get_the_app_store_and_no_tester_button()
    {
        using var factory = StoreFactory();
        factory.Api.Returns(Trail());

        var html = await GetAsAsync(factory, "/trail/trail-1", IphoneUserAgent);

        html.Should().Contain("href=\"https://apps.apple.com/se/app/id123\"");
        html.Should().NotContain("Testa på Android");
        html.Should().Contain("Har du inte Stigvidd?");
    }

    [Fact]
    public async Task The_trail_page_varies_by_user_agent()
    {
        using var factory = new LinkServiceFactory();
        factory.Api.Returns(Trail());

        var (response, _) = await GetAsync(factory, "/trail/trail-1");

        response.Headers.Vary.Should().Contain("User-Agent");
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
    public async Task The_page_is_swedish_by_default_and_offers_english()
    {
        using var factory = new LinkServiceFactory();
        factory.Api.Returns(Trail());

        var (_, html) = await GetAsync(factory, "/trail/trail-1");

        html.Should().Contain("<html lang=\"sv\">");
        html.Should().Contain(">Öppna i appen</a>");
        html.Should().Contain("href=\"/trail/trail-1?lang=en\"");
    }

    [Fact]
    public async Task English_translates_the_page_but_not_the_trail()
    {
        using var factory = new LinkServiceFactory();
        factory.Api.Returns(Trail());

        var (_, html) = await GetAsync(factory, "/trail/trail-1?lang=en");

        html.Should().Contain("<html lang=\"en\">");
        html.Should().Contain(">Open in the app</a>");
        html.Should().Contain("4.2 km · Borås");
        html.Should().Contain("<h1>Sjöleden</h1>");
        html.Should().Contain("<meta property=\"og:locale\" content=\"en_GB\"");
        html.Should().Contain("<link rel=\"canonical\" href=\"https://link.example.test/trail/trail-1?lang=en\"");
        html.Should().Contain("href=\"/trail/trail-1?lang=sv\"");
    }

    [Fact]
    public async Task An_unknown_language_falls_back_to_swedish()
    {
        using var factory = new LinkServiceFactory();
        factory.Api.Returns(Trail());

        var (_, html) = await GetAsync(factory, "/trail/trail-1?lang=de");

        html.Should().Contain("<html lang=\"sv\">");
    }

    [Fact]
    public async Task The_404_page_follows_the_chosen_language()
    {
        using var factory = new LinkServiceFactory();
        factory.Api.Returns(HttpStatusCode.NotFound);

        var (_, html) = await GetAsync(factory, "/trail/missing?lang=en");

        html.Should().Contain("Trail not found");
        html.Should().Contain("href=\"/trail/missing?lang=sv\"");
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
