// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using WebDataContracts.ResponseModels.Event;

namespace IntegrationTests.EventsController;

public class EventImageControllerTests : IClassFixture<BoardWebApplicationFactory>
{
    private readonly BoardWebApplicationFactory _factory;

    public EventImageControllerTests(BoardWebApplicationFactory factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    private static MultipartFormDataContent ImageForm(string? focusY = null)
    {
        var imageContent = new ByteArrayContent(TestImages.JpegWithGps());
        imageContent.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        var form = new MultipartFormDataContent { { imageContent, "image", "cover.jpg" } };
        if (focusY is not null)
            form.Add(new StringContent(focusY), "focusY");
        return form;
    }

    [Fact]
    public async Task PostImage_WithADecimalFocus_IsAccepted()
    {
        var identifier = await BoardRequests.CreateBoardAsync(_factory);

        var response = await BoardRequests.Client(_factory, BoardRequests.NaturElskaren)
            .PostAsync($"{BoardRequests.BASE_URL}/{identifier}/image", ImageForm("0.25"), TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task PostImage_WithAFocusOutside0To1_Is400()
    {
        var identifier = await BoardRequests.CreateBoardAsync(_factory);

        var response = await BoardRequests.Client(_factory, BoardRequests.NaturElskaren)
            .PostAsync($"{BoardRequests.BASE_URL}/{identifier}/image", ImageForm("2"), TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    private async Task<EventResponse> EventAsync(string subject, string identifier)
    {
        var detail = await BoardRequests.Client(_factory, subject).GetFromJsonAsync<EventResponse>($"{BoardRequests.BASE_URL}/{identifier}", TestContext.Current.CancellationToken);
        detail.Should().NotBeNull();
        return detail;
    }

    [Fact]
    public async Task PostImage_ThenDelete_ShowsAndThenClearsTheCover()
    {
        var identifier = await BoardRequests.CreateBoardAsync(_factory);
        var organizer = BoardRequests.Client(_factory, BoardRequests.NaturElskaren);

        var posted = await organizer.PostAsync($"{BoardRequests.BASE_URL}/{identifier}/image", ImageForm(), TestContext.Current.CancellationToken);

        posted.StatusCode.Should().Be(HttpStatusCode.Created);
        var image = await posted.Content.ReadFromJsonAsync<EventImageResponse>(TestContext.Current.CancellationToken);
        image.Should().NotBeNull();
        var shown = await EventAsync(BoardRequests.VandrarVennen, identifier);
        shown.ImageUrl.Should().Be(image.ImageUrl);
        shown.ImageIdentifier.Should().Be(image.Identifier);

        var deleted = await organizer.DeleteAsync($"{BoardRequests.BASE_URL}/{identifier}/image", TestContext.Current.CancellationToken);

        deleted.StatusCode.Should().Be(HttpStatusCode.NoContent);
        var cleared = await EventAsync(BoardRequests.VandrarVennen, identifier);
        cleared.ImageUrl.Should().BeNull();
        cleared.ImageIdentifier.Should().BeNull();
    }

    [Fact]
    public async Task PostImage_ByAParticipant_Is403NotAllowed()
    {
        var identifier = await BoardRequests.CreateBoardAsync(_factory);

        var response = await BoardRequests.Client(_factory, BoardRequests.VandrarVennen)
            .PostAsync($"{BoardRequests.BASE_URL}/{identifier}/image", ImageForm(), TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await BoardRequests.CodeOf(response)).Should().Be("not_allowed");
    }

    [Fact]
    public async Task PostImage_WithoutAFile_Is400()
    {
        var identifier = await BoardRequests.CreateBoardAsync(_factory);

        var response = await BoardRequests.Client(_factory, BoardRequests.NaturElskaren)
            .PostAsync($"{BoardRequests.BASE_URL}/{identifier}/image", new MultipartFormDataContent(), TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
