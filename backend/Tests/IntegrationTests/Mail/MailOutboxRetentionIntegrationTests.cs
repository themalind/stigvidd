// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using StigviddAPI;

namespace IntegrationTests.Mail;

/// <summary>
/// The retention half of the outbox, against a real database.
/// </summary>
/// <remarks>
/// These exist because the unit suite structurally cannot cover them: it runs on the EF
/// InMemory provider, which has neither ExecuteDeleteAsync nor ExecuteUpdateAsync
/// (docs/notes/executedelete-cannot-be-unit-tested-here.md). So the unit tests hold the
/// PREDICATES to account — which rows a rule matches — and these prove the mutation those
/// predicates drive actually happens, and touches nothing else.
///
/// Every one of these operations is irreversible, which is the reason for the pairing.
/// </remarks>
public class MailOutboxRetentionIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    public MailOutboxRetentionIntegrationTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    private IServiceScope NewScope() => _factory.Services.CreateScope();

    private static IMailOutboxRepository Repository(IServiceScope scope) =>
        scope.ServiceProvider.GetRequiredService<IMailOutboxRepository>();

    private StigViddDbContext NewContext() =>
        _factory.Services.GetRequiredService<IDbContextFactory<StigViddDbContext>>().CreateDbContext();

    private string SeedMail(
        OutboxEmailStatus status,
        string toAddress = "vandrare@example.com",
        DateTime? sentAt = null,
        DateTime? settledAt = null,
        DateTime? redactedAt = null)
    {
        var identifier = Guid.NewGuid().ToString();

        using var db = NewContext();

        db.OutboxEmails.Add(new OutboxEmail
        {
            Identifier = identifier,
            ToAddress = toAddress,
            ToName = "Vandraren",
            Subject = "Återställ ditt lösenord",
            BodyHtml = "<p>Klicka <a href=\"https://stigvidd.se/reset?token=hemlig\">här</a></p>",
            BodyText = "https://stigvidd.se/reset?token=hemlig",
            TemplateKey = "reset-password",
            Status = status,
            NextAttemptAt = DateTime.UtcNow,
            SentAt = sentAt,
            SettledAt = settledAt,
            RedactedAt = redactedAt,
            CreatedAt = DateTime.UtcNow,
            LastUpdatedAt = DateTime.UtcNow,
        });

        db.SaveChanges();

        return identifier;
    }

    private OutboxEmail? Find(string identifier)
    {
        using var db = NewContext();
        return db.OutboxEmails.AsNoTracking().FirstOrDefault(e => e.Identifier == identifier);
    }

    [Fact]
    public async Task PurgeSettledBeforeAsync_DeletesOldFailedAndCancelledMailAndSparesTheRest()
    {
        // Arrange
        var cutoff = DateTime.UtcNow.AddDays(-30);

        var oldFailed = SeedMail(OutboxEmailStatus.Failed, settledAt: cutoff.AddDays(-1));
        var oldCancelled = SeedMail(OutboxEmailStatus.Cancelled, settledAt: cutoff.AddDays(-1));
        var recentFailed = SeedMail(OutboxEmailStatus.Failed, settledAt: DateTime.UtcNow);
        var neverSettled = SeedMail(OutboxEmailStatus.Failed);
        var sent = SeedMail(OutboxEmailStatus.Sent, sentAt: cutoff.AddDays(-1), settledAt: cutoff.AddDays(-1));
        var pending = SeedMail(OutboxEmailStatus.Pending);

        // Act
        using var scope = NewScope();
        var result = await Repository(scope).PurgeSettledBeforeAsync(cutoff, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        Find(oldFailed).Should().BeNull();
        Find(oldCancelled).Should().BeNull();
        Find(recentFailed).Should().NotBeNull("it settled inside the retention window");
        Find(neverSettled).Should().NotBeNull("a row with no settle time is spared rather than guessed at");
        Find(sent).Should().NotBeNull("sent mail has its own, shorter clock");
        Find(pending).Should().NotBeNull("pending mail is outstanding work");
    }

    [Fact]
    public async Task RedactBodiesBeforeAsync_ClearsTheBodiesAndLeavesTheRowStanding()
    {
        // The row survives the redaction — it is still the diagnostic record of a mail that
        // failed, and the subject and LastError are what an operator reads. What goes is the
        // rendered body, which for this template is a working password-reset link.
        // Arrange
        var cutoff = DateTime.UtcNow.AddHours(-24);
        var identifier = SeedMail(OutboxEmailStatus.Failed, settledAt: cutoff.AddHours(-1));

        // Act
        using var scope = NewScope();
        var result = await Repository(scope).RedactBodiesBeforeAsync(cutoff, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be(1);

        var stored = Find(identifier);
        stored.Should().NotBeNull();
        stored.BodyHtml.Should().BeEmpty();
        stored.BodyText.Should().BeEmpty();
        stored.RedactedAt.Should().NotBeNull();
        stored.Subject.Should().Be("Återställ ditt lösenord", "the row stays readable as a record");
        stored.Status.Should().Be(OutboxEmailStatus.Failed);
    }

    [Fact]
    public async Task RedactBodiesBeforeAsync_DoesNotMoveTheDeletionClock()
    {
        // The trap this guards. If redaction wrote LastUpdatedAt and the settled sweep dated
        // rows by it, clearing a body would push that row's deletion date forward by the whole
        // retention period -- every hour, forever, so the row would never be deleted at all.
        // Arrange
        var settledAt = DateTime.UtcNow.AddDays(-5);
        var identifier = SeedMail(OutboxEmailStatus.Failed, settledAt: settledAt);

        // Act
        using var scope = NewScope();
        await Repository(scope).RedactBodiesBeforeAsync(
            DateTime.UtcNow.AddHours(-24), TestContext.Current.CancellationToken);

        // Assert
        var stored = Find(identifier);
        stored.Should().NotBeNull();
        stored.SettledAt.Should().BeCloseTo(settledAt, TimeSpan.FromSeconds(1));
    }

    [Fact]
    public async Task RedactBodiesBeforeAsync_IsIdempotent()
    {
        // Arrange
        var cutoff = DateTime.UtcNow.AddHours(-24);
        SeedMail(OutboxEmailStatus.Failed, settledAt: cutoff.AddHours(-1));

        using var scope = NewScope();
        var repository = Repository(scope);

        // Act
        await repository.RedactBodiesBeforeAsync(cutoff, TestContext.Current.CancellationToken);
        var second = await repository.RedactBodiesBeforeAsync(cutoff, TestContext.Current.CancellationToken);

        // Assert
        // A sweep that rewrote the same rows every hour would report work it did not do, and
        // churn the table for nothing.
        second.IsSuccess.Should().BeTrue();
        second.Value.Should().Be(0);
    }

    [Fact]
    public async Task EraseByRecipientAsync_RemovesEveryTraceOfThatAddress()
    {
        // Art. 17. The outbox has no foreign key to Users, so nothing cascades — without this
        // the address, the nickname and a live token URL outlive the account indefinitely.
        // Arrange
        const string leaving = "lamnar@example.com";
        const string staying = "stannar@example.com";

        var theirSent = SeedMail(OutboxEmailStatus.Sent, leaving, sentAt: DateTime.UtcNow);
        var theirFailed = SeedMail(OutboxEmailStatus.Failed, leaving, settledAt: DateTime.UtcNow);
        var theirPending = SeedMail(OutboxEmailStatus.Pending, leaving);
        var somebodyElse = SeedMail(OutboxEmailStatus.Sent, staying, sentAt: DateTime.UtcNow);

        // Act
        using var scope = NewScope();
        var result = await Repository(scope).EraseByRecipientAsync(leaving, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        Find(theirSent).Should().BeNull();
        Find(theirFailed).Should().BeNull();
        Find(theirPending).Should().BeNull();
        Find(somebodyElse).Should().NotBeNull();
    }

    [Fact]
    public async Task EraseByRecipientAsync_MatchesTheAddressRegardlessOfCase()
    {
        // Addresses arrive however the user typed them. ToLower on both sides rather than a
        // collation or ILike, because Postgres and SQLite disagree about both -- and an erasure
        // that quietly matched nothing on one of them is the worst possible failure here.
        // Arrange
        var identifier = SeedMail(OutboxEmailStatus.Sent, "Vandrare@Example.COM", sentAt: DateTime.UtcNow);

        // Act
        using var scope = NewScope();
        var result = await Repository(scope).EraseByRecipientAsync(
            "vandrare@example.com", TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        Find(identifier).Should().BeNull();
    }

    [Fact]
    public async Task EraseByRecipientAsync_LeavesAMailThatIsOnTheWireButStopsAQueuedOne()
    {
        // The one row erasure may not delete. The dispatcher is holding a Sending row right now
        // and nothing can recall a message already handed to SMTP; deleting it under the worker
        // would make MarkSentAsync's NotFound the only trace that it went out. It settles within
        // seconds and the sweep collects it.
        //
        // A Pending row is the opposite case: it must NOT go out, so it is cancelled first --
        // which takes it out of the dispatcher's reach, since claiming guards on Pending -- and
        // then deleted in the same call.
        // Arrange
        const string leaving = "lamnar@example.com";
        var sending = SeedMail(OutboxEmailStatus.Sending, leaving);
        var pending = SeedMail(OutboxEmailStatus.Pending, leaving);

        // Act
        using var scope = NewScope();
        var result = await Repository(scope).EraseByRecipientAsync(leaving, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        Find(pending).Should().BeNull();

        var onTheWire = Find(sending);
        onTheWire.Should().NotBeNull();
        onTheWire.Status.Should().Be(OutboxEmailStatus.Sending);
    }
}
