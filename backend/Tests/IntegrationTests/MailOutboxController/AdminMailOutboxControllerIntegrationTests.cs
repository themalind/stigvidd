// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using WebDataContracts.RequestModels.MailOutbox;
using WebDataContracts.ResponseModels.MailOutbox;

namespace IntegrationTests.MailOutboxController;

/// <summary>
/// The outbox admin surface against the real host and a real (SQLite) database.
/// </summary>
/// <remarks>
/// The factory removes MailOutboxDispatcher from the hosted services but leaves
/// IMailOutboxQueue registered, so a retry's signal goes into a channel nothing drains. These
/// tests therefore assert on the OutboxEmails ROW, never on SentMails, and never wait for a
/// send. Purge is also the one thing that cannot be covered by a unit test: it uses
/// ExecuteDeleteAsync, which the EF InMemory provider the unit suite runs on does not support.
/// </remarks>
public class AdminMailOutboxControllerIntegrationTests
    : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private const string Route = "/api/v1/admin/mail-outbox";
    private const string AuthenticatedUser = "firebase-uid-12346"; // VandrarVennen
    private const string AdminRole = "stigvidd-admin";

    private readonly StigViddWebApplicationFactory<Program> _factory;

    public AdminMailOutboxControllerIntegrationTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    private HttpClient AdminClient()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);
        client.DefaultRequestHeaders.Add("X-Test-Roles", AdminRole);
        return client;
    }

    private StigViddDbContext NewContext()
    {
        var scope = _factory.Services.CreateScope();
        return scope.ServiceProvider
            .GetRequiredService<IDbContextFactory<StigViddDbContext>>()
            .CreateDbContext();
    }

    /// <summary>Puts one row in the outbox and returns its identifier.</summary>
    private string SeedMail(
        OutboxEmailStatus status = OutboxEmailStatus.Pending,
        string? toAddress = null,
        DateTime? sentAt = null,
        int attempts = 0,
        string? lastError = null,
        DateTime? settledAt = null,
        DateTime? redactedAt = null)
    {
        var identifier = Guid.NewGuid().ToString();

        using var db = NewContext();

        db.OutboxEmails.Add(new OutboxEmail
        {
            Identifier = identifier,
            ToAddress = toAddress ?? "vandrare@example.com",
            Subject = "Hej",
            BodyHtml = "<p>Hej</p>",
            BodyText = "Hej",
            TemplateKey = "welcome",
            Status = status,
            Attempts = attempts,
            NextAttemptAt = DateTime.UtcNow,
            SentAt = sentAt,
            LastError = lastError,
            SettledAt = settledAt,
            RedactedAt = redactedAt,
            CreatedAt = DateTime.UtcNow,
            LastUpdatedAt = DateTime.UtcNow,
        });

        db.SaveChanges();

        return identifier;
    }

    private OutboxEmail ReadBack(string identifier)
    {
        using var db = NewContext();
        var row = db.OutboxEmails.AsNoTracking().FirstOrDefault(e => e.Identifier == identifier);
        row.Should().NotBeNull();
        return row;
    }

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
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var response = await client.GetAsync(Route, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task GetAll_ReturnsAPageAndNeverCarriesAMailBody()
    {
        // Arrange
        SeedMail();

        // Act
        var response = await AdminClient().GetAsync(
            $"{Route}?page=1&pageSize=5", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.Should().NotContain("bodyHtml", "a list page must never carry rendered mail bodies");
    }

    [Fact]
    public async Task GetAll_WithAnUnknownStatus_ShouldReturnBadRequest()
    {
        // Showing a full outbox as an empty one would be the worst possible answer.
        var response = await AdminClient().GetAsync(
            $"{Route}?status=Panding", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // The bodies are no longer part of the detail response. This pins the half that matters for
    // privacy: an operator browsing the outbox does not pull a nickname and, for a reset-password
    // row, a live token URL down to their browser for every mail they click.
    [Fact]
    public async Task GetByIdentifier_DoesNotReturnTheRenderedBodies()
    {
        // Arrange
        var identifier = SeedMail();

        // Act
        var response = await AdminClient().GetAsync(
            $"{Route}/{identifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var detail = await response.Content.ReadFromJsonAsync<OutboxEmailDetailResponse>(
            TestContext.Current.CancellationToken);

        detail.Should().NotBeNull();
        detail.Email.Identifier.Should().Be(identifier);

        // Asserted on the wire, not the DTO: a body that reached the browser would do so as
        // JSON whatever the C# type says.
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.Should().NotContain("<p>Hej</p>");
    }

    [Fact]
    public async Task GetBody_ReturnsTheRenderedBodies()
    {
        // Arrange
        var identifier = SeedMail();

        // Act
        var response = await AdminClient().GetAsync(
            $"{Route}/{identifier}/body", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<OutboxEmailBodyResponse>(
            TestContext.Current.CancellationToken);

        body.Should().NotBeNull();
        body.Identifier.Should().Be(identifier);
        body.BodyHtml.Should().Be("<p>Hej</p>");
        body.BodyText.Should().Be("Hej");
    }

    [Fact]
    public async Task GetBody_ForARedactedMail_ShouldReturnNotFound()
    {
        // Arrange
        var identifier = SeedMail(
            OutboxEmailStatus.Failed,
            settledAt: DateTime.UtcNow.AddDays(-2),
            redactedAt: DateTime.UtcNow.AddDays(-1));

        // Act
        var response = await AdminClient().GetAsync(
            $"{Route}/{identifier}/body", TestContext.Current.CancellationToken);

        // Assert
        // 404 rather than an empty body: an empty body is indistinguishable from a render that
        // went wrong, and the operator would go looking for a bug instead of reading the rule.
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetByIdentifier_ForAnUnknownMail_ShouldReturnNotFound()
    {
        var response = await AdminClient().GetAsync(
            $"{Route}/no-such-mail", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetCounts_CountsTheSeededRow()
    {
        // Arrange
        SeedMail(OutboxEmailStatus.Failed);

        // Act
        var response = await AdminClient().GetAsync(
            $"{Route}/counts", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var counts = await response.Content.ReadFromJsonAsync<MailOutboxCountsResponse>(
            TestContext.Current.CancellationToken);

        counts.Should().NotBeNull();
        counts.Failed.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task Retry_OnAFailedMail_PutsTheRowBackInTheQueueDueNow()
    {
        // Arrange
        var identifier = SeedMail(OutboxEmailStatus.Failed, attempts: 5, lastError: "Connection refused");

        // Act
        var response = await AdminClient().PostAsync(
            $"{Route}/{identifier}/retry", null, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var row = ReadBack(identifier);
        row.Status.Should().Be(OutboxEmailStatus.Pending);
        row.Attempts.Should().Be(0, "a retry must buy a whole ladder, not one more attempt");
        row.LastError.Should().Be("Connection refused", "it is still the only record of why this failed");
    }

    [Fact]
    public async Task Retry_OnAMailBeingSentRightNow_ShouldReturnConflict()
    {
        // The dispatcher holds a Sending row. Moving it back to Pending would make it claimable
        // while a worker still has it, and the mail would go out twice.
        // Arrange
        var identifier = SeedMail(OutboxEmailStatus.Sending);

        // Act
        var response = await AdminClient().PostAsync(
            $"{Route}/{identifier}/retry", null, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        ReadBack(identifier).Status.Should().Be(OutboxEmailStatus.Sending);
    }

    [Fact]
    public async Task Cancel_OnAPendingMail_StopsIt()
    {
        // Arrange
        var identifier = SeedMail();

        // Act
        var response = await AdminClient().PostAsync(
            $"{Route}/{identifier}/cancel", null, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        ReadBack(identifier).Status.Should().Be(OutboxEmailStatus.Cancelled);
    }

    [Fact]
    public async Task Cancel_OnAnAlreadySentMail_ShouldReturnConflict()
    {
        // Arrange
        var identifier = SeedMail(OutboxEmailStatus.Sent, sentAt: DateTime.UtcNow);

        // Act
        var response = await AdminClient().PostAsync(
            $"{Route}/{identifier}/cancel", null, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        ReadBack(identifier).Status.Should().Be(OutboxEmailStatus.Sent);
    }

    [Fact]
    public async Task Purge_WithoutConfirm_ShouldReturnBadRequestAndDeleteNothing()
    {
        // Arrange
        var identifier = SeedMail(OutboxEmailStatus.Sent, sentAt: DateTime.UtcNow.AddDays(-90));

        // Act
        var response = await AdminClient().PostAsJsonAsync(
            $"{Route}/purge",
            new PurgeMailOutboxRequest { OlderThanDays = 30, Confirm = false },
            TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        ReadBack(identifier).Should().NotBeNull();
    }

    [Fact]
    public async Task Purge_WithAnOmittedCutoff_ShouldReturnBadRequest()
    {
        // 0 is the JSON default, and without the floor it would mean "everything".
        // Arrange
        var identifier = SeedMail(OutboxEmailStatus.Sent, sentAt: DateTime.UtcNow.AddDays(-90));

        // Act
        var response = await AdminClient().PostAsJsonAsync(
            $"{Route}/purge",
            new PurgeMailOutboxRequest { Confirm = true },
            TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        ReadBack(identifier).Should().NotBeNull();
    }

    [Fact]
    public async Task Purge_DeletesOldSentMailAndSparesEverythingElse()
    {
        // The one assertion that needs a real provider: ExecuteDeleteAsync is unsupported on
        // EF InMemory, so this cannot be a unit test.
        // Arrange
        var oldSent = SeedMail(OutboxEmailStatus.Sent, sentAt: DateTime.UtcNow.AddDays(-90));
        var recentSent = SeedMail(OutboxEmailStatus.Sent, sentAt: DateTime.UtcNow.AddDays(-1));
        var oldFailed = SeedMail(OutboxEmailStatus.Failed);
        var pending = SeedMail();

        // Act
        var response = await AdminClient().PostAsJsonAsync(
            $"{Route}/purge",
            new PurgeMailOutboxRequest { OlderThanDays = 30, Confirm = true },
            TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var purge = await response.Content.ReadFromJsonAsync<MailOutboxPurgeResponse>(
            TestContext.Current.CancellationToken);
        purge.Should().NotBeNull();
        purge.Deleted.Should().BeGreaterThan(0);

        using var db = NewContext();
        db.OutboxEmails.Any(e => e.Identifier == oldSent).Should().BeFalse();
        db.OutboxEmails.Any(e => e.Identifier == recentSent).Should().BeTrue("it was sent recently");
        db.OutboxEmails.Any(e => e.Identifier == oldFailed).Should().BeTrue("failed mail is the diagnostic record");
        db.OutboxEmails.Any(e => e.Identifier == pending).Should().BeTrue("pending mail is outstanding work");
    }
}
