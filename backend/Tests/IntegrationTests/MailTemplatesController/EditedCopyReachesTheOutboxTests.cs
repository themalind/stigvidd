// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Interfaces.Services;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace IntegrationTests.MailTemplatesController;

/// <summary>
/// The point of the whole feature, end to end: copy edited in the admin editor is the copy
/// that goes out.
///
/// This is the crossing the editor exists to make. MailTemplatesController writes the row, and
/// MailOutboxService reads it back through a completely separate path (GetByKeyAsync) when
/// something asks for a mail; nothing else in the suite exercises both halves together. The
/// alternative way to check it is to bring the stack up under compose and register a real
/// user, which needs a hand-carried .env and ./db-certs that a plain checkout does not have —
/// see docs/notes/compose-up-needs-two-hand-carried-things-that-are-not-in-the-repo.md.
/// </summary>
public class EditedCopyReachesTheOutboxTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private const string Route = "/api/v1/admin/mail-templates";
    private const string Identifier = "test-outbox-roundtrip";
    private const string Key = "welcome";

    private const string AuthenticatedUser = "firebase-uid-12346";
    private const string AdminRole = "stigvidd-admin";

    private readonly StigViddWebApplicationFactory<Program> _factory;

    public EditedCopyReachesTheOutboxTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
        Seed();
    }

    // The production rows arrive via migrations' InsertData and no test applies a migration,
    // so the fixture seeds its own — and puts the copy back between tests, since one test's
    // edit must not decide what the next one reads.
    private void Seed()
    {
        using var scope = _factory.Services.CreateScope();
        using var db = Db(scope);

        var existing = db.MailTemplates.FirstOrDefault(t => t.Identifier == Identifier);

        if (existing is null)
        {
            db.MailTemplates.Add(new MailTemplate
            {
                Identifier = Identifier,
                Key = Key,
                Language = "sv",
                Subject = "Välkommen till Stigvidd, {{NickName}}!",
                BodyHtml = "<p>Hej {{NickName}},</p>",
                BodyText = "Hej {{NickName}},",
            });
        }
        else
        {
            existing.Subject = "Välkommen till Stigvidd, {{NickName}}!";
            existing.BodyHtml = "<p>Hej {{NickName}},</p>";
            existing.BodyText = "Hej {{NickName}},";
        }

        db.SaveChanges();
    }

    private static StigViddDbContext Db(IServiceScope scope) =>
        scope.ServiceProvider.GetRequiredService<IDbContextFactory<StigViddDbContext>>().CreateDbContext();

    private HttpClient AdminClient()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);
        client.DefaultRequestHeaders.Add("X-Test-Roles", AdminRole);
        return client;
    }

    [Fact]
    public async Task CopyEditedThroughTheAdminApi_IsTheCopyTheNextMailCarries()
    {
        // Arrange — an operator rewrites the wording, exactly as the editor PUTs it.
        var response = await AdminClient().PutAsJsonAsync(
            $"{Route}/{Identifier}",
            new
            {
                subject = "Hej {{NickName}}, välkommen!",
                bodyHtml = "<p>Så roligt att du är här, {{NickName}}.</p>",
                bodyText = "Så roligt att du är här, {{NickName}}.",
                description = "Redigerad i admin.",
            },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Act — something sends that mail. The outbox renders at ENQUEUE time, so the row it
        // journals is the finished message rather than a reference to the template.
        using var scope = _factory.Services.CreateScope();

        var enqueued = await scope.ServiceProvider
            .GetRequiredService<IMailOutboxService>()
            .EnqueueAsync(
                Key,
                "vandrare@example.com",
                new Dictionary<string, string?> { ["NickName"] = "Ralf" },
                TestContext.Current.CancellationToken);

        enqueued.Success.Should().BeTrue();

        // Assert — the queued mail carries the edit, substituted, in both parts.
        using var db = Db(scope);

        var mail = await db.OutboxEmails
            .FirstAsync(email => email.Identifier == enqueued.Value, TestContext.Current.CancellationToken);

        mail.Subject.Should().Be("Hej Ralf, välkommen!");
        mail.BodyHtml.Should().Be("<p>Så roligt att du är här, Ralf.</p>");
        mail.BodyText.Should().Be("Så roligt att du är här, Ralf.");

        Seed();
    }

    [Fact]
    public async Task CopyTheApiRefused_NeverReachesTheOutbox()
    {
        // The refusal is not advisory. A template using a placeholder the caller does not
        // supply cannot render, so the mail is never sent and nobody is told — which is why
        // the save is blocked outright rather than warned about.
        var response = await AdminClient().PutAsJsonAsync(
            $"{Route}/{Identifier}",
            new
            {
                subject = "Hej {{NickName}}",
                bodyHtml = "<p>Hej {{TrailName}}</p>",
                bodyText = "Hej",
                description = (string?)null,
            },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // The stored copy is untouched, so the mail still sends.
        using var scope = _factory.Services.CreateScope();

        var enqueued = await scope.ServiceProvider
            .GetRequiredService<IMailOutboxService>()
            .EnqueueAsync(
                Key,
                "vandrare@example.com",
                new Dictionary<string, string?> { ["NickName"] = "Ralf" },
                TestContext.Current.CancellationToken);

        enqueued.Success.Should().BeTrue("the refused edit must not have been written");
    }
}
