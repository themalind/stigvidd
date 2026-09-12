// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using WebDataContracts.RequestModels.MailTemplate;
using WebDataContracts.ResponseModels.MailTemplate;

namespace IntegrationTests.MailTemplatesController;

/// <summary>
/// Editing mail copy over HTTP. What is really being proved here is that the route, the
/// model binding, the validator and the Admin policy line up -- and that the one edit which
/// would stop mail going out is refused by the running host rather than only by a unit test.
/// </summary>
public class MailTemplatesControllerIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private const string Route = "/api/v1/admin/mail-templates";

    private const string AuthenticatedUser = "firebase-uid-12346"; // VandrarVennen
    private const string AdminRole = "stigvidd-admin";

    // The production rows arrive via migrations' InsertData, and no test applies a migration
    // -- the suite builds its schema with EnsureCreated. So the fixture seeds its own.
    private const string VerifyEmailIdentifier = "test-verify-email-sv";

    private readonly StigViddWebApplicationFactory<Program> _factory;

    public MailTemplatesControllerIntegrationTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
        SeedTemplate();
    }

    private void SeedTemplate()
    {
        using var scope = _factory.Services.CreateScope();
        using var db = scope.ServiceProvider
            .GetRequiredService<IDbContextFactory<StigViddDbContext>>()
            .CreateDbContext();

        var existing = db.MailTemplates.FirstOrDefault(t => t.Identifier == VerifyEmailIdentifier);

        if (existing is not null)
        {
            // Each test in the class shares the fixture, so put the copy back rather than
            // letting one test's edit decide what the next one reads.
            existing.Subject = "Bekräfta din e-postadress hos Stigvidd";
            existing.BodyHtml = "<p>Hej {{NickName}},</p><p><a href=\"{{VerificationUrl}}\">Bekräfta</a></p><p>{{VerificationCode}}</p>";
            existing.BodyText = "Hej {{NickName}}, {{VerificationUrl}} {{VerificationCode}}";
            db.SaveChanges();
            return;
        }

        db.MailTemplates.Add(new MailTemplate
        {
            Identifier = VerifyEmailIdentifier,
            Key = "verify-email",
            Language = "sv",
            Subject = "Bekräfta din e-postadress hos Stigvidd",
            BodyHtml = "<p>Hej {{NickName}},</p><p><a href=\"{{VerificationUrl}}\">Bekräfta</a></p><p>{{VerificationCode}}</p>",
            BodyText = "Hej {{NickName}}, {{VerificationUrl}} {{VerificationCode}}",
            Description = "Skickas vid registrering.",
        });

        db.SaveChanges();
    }

    private HttpClient AdminClient()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);
        client.DefaultRequestHeaders.Add("X-Test-Roles", AdminRole);
        return client;
    }

    private static UpdateMailTemplateRequest ValidUpdate() => new()
    {
        Subject = "Bekräfta din e-postadress",
        BodyHtml = "<p>Hej {{NickName}},</p><p><a href=\"{{VerificationUrl}}\">Bekräfta</a></p><p>{{VerificationCode}}</p>",
        BodyText = "Hej {{NickName}}, {{VerificationUrl}} {{VerificationCode}}",
        Description = "Skickas vid registrering.",
    };

    [Fact]
    public async Task GetAll_WhenUnauthenticated_ShouldReturnUnauthorized()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = null;

        var response = await client.GetAsync(Route, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetAll_WithoutAdminRole_ShouldReturnForbidden()
    {
        // Mail copy is read as well as written here: the subject line of every template is a
        // piece of the product's voice, and the edit surface is the same route.
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var response = await client.GetAsync(Route, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Update_WithoutAdminRole_ShouldReturnForbidden()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var response = await client.PutAsJsonAsync(
            $"{Route}/{VerifyEmailIdentifier}", ValidUpdate(), TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task GetAll_AsAdmin_ListsTheSeededTemplate()
    {
        var response = await AdminClient().GetAsync(Route, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var templates = await response.Content.ReadFromJsonAsync<List<MailTemplateListItemResponse>>(
            TestContext.Current.CancellationToken);

        templates.Should().NotBeNull();
        templates!.Should().Contain(template => template.Identifier == VerifyEmailIdentifier);
        templates.Single(template => template.Identifier == VerifyEmailIdentifier)
            .IsKnown.Should().BeTrue("verify-email is declared in the catalogue");
    }

    [Fact]
    public async Task GetByIdentifier_AsAdmin_CarriesTheCatalogueAlongsideTheCopy()
    {
        var response = await AdminClient().GetAsync(
            $"{Route}/{VerifyEmailIdentifier}", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var template = await response.Content.ReadFromJsonAsync<MailTemplateResponse>(
            TestContext.Current.CancellationToken);

        template.Should().NotBeNull();
        template!.Key.Should().Be("verify-email");
        template.Purpose.Should().NotBeNullOrWhiteSpace();
        template.Tokens.Select(token => token.Name)
            .Should().BeEquivalentTo(["NickName", "VerificationUrl", "VerificationCode"]);
        template.Tokens.Should().OnlyContain(token => token.IsUsed);
        template.UnknownTokens.Should().BeEmpty();
        template.MissingTokens.Should().BeEmpty();
    }

    [Fact]
    public async Task GetByIdentifier_WhenTheTemplateDoesNotExist_ShouldReturnNotFound()
    {
        var response = await AdminClient().GetAsync($"{Route}/no-such-row", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Update_AsAdmin_SavesTheCopy()
    {
        var request = ValidUpdate();
        request.Subject = "Bekräfta din e-postadress, {{NickName}}";

        var response = await AdminClient().PutAsJsonAsync(
            $"{Route}/{VerifyEmailIdentifier}", request, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Read it back over HTTP rather than trusting the response body.
        var reread = await AdminClient().GetFromJsonAsync<MailTemplateResponse>(
            $"{Route}/{VerifyEmailIdentifier}", TestContext.Current.CancellationToken);

        reread!.Subject.Should().Be("Bekräfta din e-postadress, {{NickName}}");

        SeedTemplate();
    }

    [Fact]
    public async Task Update_WithAPlaceholderTheCallerDoesNotSupply_IsRefusedByTheRunningHost()
    {
        // The edit that would stop registration mail entirely. A unit test already covers the
        // rule; this proves the route really reaches it.
        var request = ValidUpdate();
        request.BodyHtml = "<p>Hej {{NickNmae}},</p>";

        var response = await AdminClient().PutAsJsonAsync(
            $"{Route}/{VerifyEmailIdentifier}", request, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.Should().Contain("NickNmae");

        // And nothing was written.
        var reread = await AdminClient().GetFromJsonAsync<MailTemplateResponse>(
            $"{Route}/{VerifyEmailIdentifier}", TestContext.Current.CancellationToken);

        reread!.BodyHtml.Should().NotContain("NickNmae");
    }

    [Fact]
    public async Task Update_DroppingTheVerificationLink_IsAllowedButReported()
    {
        // Renders perfectly well, and mails somebody a verification with no way to verify.
        // That is a judgement for the operator, so the API reports rather than refuses.
        var request = ValidUpdate();
        request.BodyHtml = "<p>Hej {{NickName}}, koden är {{VerificationCode}}</p>";
        request.BodyText = "Hej {{NickName}}, koden är {{VerificationCode}}";

        var response = await AdminClient().PutAsJsonAsync(
            $"{Route}/{VerifyEmailIdentifier}", request, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var updated = await response.Content.ReadFromJsonAsync<MailTemplateResponse>(
            TestContext.Current.CancellationToken);

        updated!.MissingTokens.Should().Contain("VerificationUrl");

        SeedTemplate();
    }

    [Fact]
    public async Task Update_WithMarkupOutsideTheAllowlist_IsRefusedByTheValidator()
    {
        var request = ValidUpdate();
        request.BodyHtml = "<p>Hej {{NickName}}</p><script>alert(1)</script>";

        var response = await AdminClient().PutAsJsonAsync(
            $"{Route}/{VerifyEmailIdentifier}", request, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Update_WithAnEmptyTextBody_IsRefused()
    {
        // multipart/alternative without a text part reads as an empty mail in a plain-text
        // client and scores as spam everywhere else.
        var request = ValidUpdate();
        request.BodyText = "";

        var response = await AdminClient().PutAsJsonAsync(
            $"{Route}/{VerifyEmailIdentifier}", request, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Preview_RendersTheDraftWithSampleValues_AndChangesNothing()
    {
        var draft = new PreviewMailTemplateRequest
        {
            Subject = "Hej {{NickName}}",
            BodyHtml = "<p>Hej {{NickName}}</p>",
            BodyText = "Hej {{NickName}}",
        };

        var response = await AdminClient().PostAsJsonAsync(
            $"{Route}/{VerifyEmailIdentifier}/preview", draft, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var preview = await response.Content.ReadFromJsonAsync<MailTemplatePreviewResponse>(
            TestContext.Current.CancellationToken);

        preview!.Subject.Should().Be("Hej Ralf");

        var reread = await AdminClient().GetFromJsonAsync<MailTemplateResponse>(
            $"{Route}/{VerifyEmailIdentifier}", TestContext.Current.CancellationToken);

        reread!.Subject.Should().Be("Bekräfta din e-postadress hos Stigvidd");
    }

    [Fact]
    public async Task Preview_WhenTheDraftWouldNotRender_SaysSoBeforeAnythingIsSaved()
    {
        var draft = new PreviewMailTemplateRequest
        {
            Subject = "Hej",
            BodyHtml = "<p>Hej {{NickNmae}}</p>",
            BodyText = "Hej",
        };

        var response = await AdminClient().PostAsJsonAsync(
            $"{Route}/{VerifyEmailIdentifier}/preview", draft, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.Should().Contain("NickNmae");
    }
}
