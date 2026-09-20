// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace UnitTests.RepositoryTests;

public class MailOutboxRepositoryTests : TestBase
{
    private const int MaxAttempts = 5;

    private static MailOutboxRepository Build(IDbContextFactory<StigViddDbContext> factory) =>
        new(factory, NullLogger<MailOutboxRepository>.Instance);

    private static OutboxEmail MakeEmail(
        int id,
        OutboxEmailStatus status = OutboxEmailStatus.Pending,
        DateTime? nextAttemptAt = null,
        int attempts = 0,
        DateTime? settledAt = null,
        DateTime? redactedAt = null) =>
        new()
        {
            Id = id,
            Identifier = $"mail-{id}",
            ToAddress = "vandrare@example.com",
            Subject = "Hej",
            BodyHtml = "<p>Hej</p>",
            BodyText = "Hej",
            TemplateKey = "welcome",
            Status = status,
            Attempts = attempts,
            NextAttemptAt = nextAttemptAt ?? DateTime.UtcNow.AddMinutes(-1),
            SettledAt = settledAt,
            RedactedAt = redactedAt,
            CreatedAt = Utilities.SeedDates.Created,
            LastUpdatedAt = Utilities.SeedDates.Updated,
        };

    private static Action<StigViddDbContext> Seed(params OutboxEmail[] emails) =>
        db => db.OutboxEmails.AddRange(emails);

    // ---- The admin surface ----

    [Theory]
    [InlineData(OutboxEmailStatus.Failed)]
    [InlineData(OutboxEmailStatus.Cancelled)]
    public async Task RequeueAsync_FromASettledStatus_MakesItPendingAndDueNow(OutboxEmailStatus from)
    {
        // Arrange
        var repo = Build(CreateSeededFactory(Seed(
            MakeEmail(1, from, nextAttemptAt: DateTime.UtcNow.AddHours(3), attempts: MaxAttempts))));

        // Act
        var result = await repo.RequeueAsync("mail-1", TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Status.Should().Be(OutboxEmailStatus.Pending);
        result.Value.NextAttemptAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task RequeueAsync_ClearsTheSettleTime()
    {
        // The row is leaving the terminal state, so the moment it settled is no longer true.
        // Leave it and a row that fails again keeps its FIRST settle time -- and the retention
        // sweep deletes it early, counting from a failure the operator has already answered.
        // Arrange
        var repo = Build(CreateSeededFactory(Seed(
            MakeEmail(1, OutboxEmailStatus.Failed, settledAt: DateTime.UtcNow.AddDays(-20)))));

        // Act
        var result = await repo.RequeueAsync("mail-1", TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.SettledAt.Should().BeNull();
    }

    [Fact]
    public async Task RequeueAsync_WhenTheBodyHasBeenRedacted_IsAConflict()
    {
        // The body is gone, so there is nothing left to send. This is the ONLY path by which a
        // redacted row could reach a recipient, and delivering a blank mail to someone who asked
        // for a password reset is worse than refusing to try.
        // Arrange
        var repo = Build(CreateSeededFactory(Seed(
            MakeEmail(
                1,
                OutboxEmailStatus.Failed,
                settledAt: DateTime.UtcNow.AddDays(-2),
                redactedAt: DateTime.UtcNow.AddDays(-1)))));

        // Act
        var result = await repo.RequeueAsync("mail-1", TestContext.Current.CancellationToken);

        // Assert
        result.Status.Should().Be(RepositoryResultStatus.Conflict);
    }

    [Fact]
    public async Task RequeueAsync_ResetsTheAttemptLadder()
    {
        // A Failed row sits AT the cap. Leaving Attempts there means the retry buys exactly one
        // more attempt -- Pending -> Sending -> Failed with no backoff at all -- which is not
        // what retry means to an operator who has just fixed the mail server.
        // Arrange
        var repo = Build(CreateSeededFactory(Seed(
            MakeEmail(1, OutboxEmailStatus.Failed, attempts: MaxAttempts))));

        // Act
        var result = await repo.RequeueAsync("mail-1", TestContext.Current.CancellationToken);

        // Assert
        result.Value.Should().NotBeNull();
        result.Value.Attempts.Should().Be(0);
    }

    [Fact]
    public async Task RequeueAsync_KeepsLastError()
    {
        // It is the only record of WHY this failed, and the retry has not produced a new one
        // yet. MarkSentAsync nulls it on success; MarkFailedAsync overwrites it on the next
        // failure. Clearing it here destroys the diagnosis for no gain.
        // Arrange
        var email = MakeEmail(1, OutboxEmailStatus.Failed, attempts: MaxAttempts);
        email.LastError = "Connection refused";
        var repo = Build(CreateSeededFactory(Seed(email)));

        // Act
        var result = await repo.RequeueAsync("mail-1", TestContext.Current.CancellationToken);

        // Assert
        result.Value.Should().NotBeNull();
        result.Value.LastError.Should().Be("Connection refused");
    }

    [Theory]
    [InlineData(OutboxEmailStatus.Pending)]
    [InlineData(OutboxEmailStatus.Sending)]
    [InlineData(OutboxEmailStatus.Sent)]
    public async Task RequeueAsync_FromAnyOtherStatus_IsAConflict(OutboxEmailStatus from)
    {
        // Sending is the one that matters: a worker holds that row right now, and moving it
        // back to Pending would make it claimable while it is still being sent -- the same mail
        // delivered twice, which is exactly what claiming in the database exists to prevent.
        // Arrange
        var repo = Build(CreateSeededFactory(Seed(MakeEmail(1, from))));

        // Act
        var result = await repo.RequeueAsync("mail-1", TestContext.Current.CancellationToken);

        // Assert
        result.Status.Should().Be(RepositoryResultStatus.Conflict);
    }

    [Fact]
    public async Task RequeueAsync_ForAnUnknownIdentifier_IsNotFound()
    {
        // Arrange
        var repo = Build(CreateSeededFactory(Seed(MakeEmail(1, OutboxEmailStatus.Failed))));

        // Act
        var result = await repo.RequeueAsync("no-such-mail", TestContext.Current.CancellationToken);

        // Assert
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task CancelAsync_WhenPending_StopsIt()
    {
        // Arrange
        var repo = Build(CreateSeededFactory(Seed(MakeEmail(1))));

        // Act
        var result = await repo.CancelAsync("mail-1", TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Status.Should().Be(OutboxEmailStatus.Cancelled);
    }

    [Theory]
    [InlineData(OutboxEmailStatus.Sending)]
    [InlineData(OutboxEmailStatus.Sent)]
    [InlineData(OutboxEmailStatus.Failed)]
    [InlineData(OutboxEmailStatus.Cancelled)]
    public async Task CancelAsync_FromAnyOtherStatus_IsAConflict(OutboxEmailStatus from)
    {
        // Sending especially: the mail may already be on the wire, cancelling cannot un-send it,
        // and MarkSentAsync has no status guard -- so the dispatcher would overwrite the
        // cancellation a moment later and the operator would have been told a lie.
        // Arrange
        var repo = Build(CreateSeededFactory(Seed(MakeEmail(1, from))));

        // Act
        var result = await repo.CancelAsync("mail-1", TestContext.Current.CancellationToken);

        // Assert
        result.Status.Should().Be(RepositoryResultStatus.Conflict);
    }

    [Fact]
    public async Task GetPendingIdsAsync_IgnoresACancelledRow()
    {
        // The whole reason Cancelled is its own enum value. Modelled as "Pending plus a flag",
        // the boot re-signal would resurrect every cancelled mail on every restart -- and no
        // test on a process that never dies would ever show it.
        // Arrange
        var repo = Build(CreateSeededFactory(Seed(
            MakeEmail(1, OutboxEmailStatus.Cancelled),
            MakeEmail(2, OutboxEmailStatus.Pending))));

        // Act
        var result = await repo.GetPendingIdsAsync(TestContext.Current.CancellationToken);

        // Assert
        result.Value.Should().NotBeNull();
        result.Value.Should().BeEquivalentTo([2]);
    }

    [Fact]
    public async Task ResetInterruptedAsync_IgnoresACancelledRow()
    {
        // Arrange
        var repo = Build(CreateSeededFactory(Seed(
            MakeEmail(1, OutboxEmailStatus.Cancelled),
            MakeEmail(2, OutboxEmailStatus.Sending))));

        // Act
        var result = await repo.ResetInterruptedAsync(TestContext.Current.CancellationToken);

        // Assert
        result.Value.Should().Be(1);
    }

    [Fact]
    public async Task GetPagedAsync_OrdersNewestFirstAndReportsTheTotal()
    {
        // Arrange
        var older = MakeEmail(1);
        older.CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var newer = MakeEmail(2);
        newer.CreatedAt = new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc);
        var repo = Build(CreateSeededFactory(Seed(older, newer)));

        // Act
        var result = await repo.GetPagedAsync(
            null, null, null, 1, 25, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.TotalCount.Should().Be(2);
        result.Value.Items.Select(i => i.Identifier).Should().ContainInOrder("mail-2", "mail-1");
    }

    [Fact]
    public async Task GetPagedAsync_FiltersByStatus()
    {
        // Arrange
        var repo = Build(CreateSeededFactory(Seed(
            MakeEmail(1, OutboxEmailStatus.Failed),
            MakeEmail(2, OutboxEmailStatus.Sent))));

        // Act
        var result = await repo.GetPagedAsync(
            OutboxEmailStatus.Failed, null, null, 1, 25, TestContext.Current.CancellationToken);

        // Assert
        result.Value.Should().NotBeNull();
        result.Value.Items.Select(i => i.Identifier).Should().BeEquivalentTo(["mail-1"]);
    }

    [Fact]
    public async Task GetPagedAsync_MatchesTheRecipientCaseInsensitively()
    {
        // LIKE is case-sensitive on Postgres and case-insensitive on SQLite, so a bare Contains
        // would behave one way here and another in production.
        // Arrange
        var email = MakeEmail(1);
        email.ToAddress = "Vandrare@Example.com";
        var other = MakeEmail(2);
        other.ToAddress = "nagon.annan@example.com";
        var repo = Build(CreateSeededFactory(Seed(email, other)));

        // Act
        var result = await repo.GetPagedAsync(
            null, null, "VANDRARE@EXAMPLE", 1, 25, TestContext.Current.CancellationToken);

        // Assert
        result.Value.Should().NotBeNull();
        result.Value.Items.Select(i => i.Identifier).Should().BeEquivalentTo(["mail-1"]);
    }

    [Fact]
    public async Task GetCountsByStatusAsync_CountsEachStatusSeparately()
    {
        // Arrange
        var repo = Build(CreateSeededFactory(Seed(
            MakeEmail(1, OutboxEmailStatus.Pending),
            MakeEmail(2, OutboxEmailStatus.Failed),
            MakeEmail(3, OutboxEmailStatus.Failed),
            MakeEmail(4, OutboxEmailStatus.Cancelled))));

        // Act
        var result = await repo.GetCountsByStatusAsync(TestContext.Current.CancellationToken);

        // Assert
        result.Value.Should().NotBeNull();
        result.Value[OutboxEmailStatus.Failed].Should().Be(2);
        result.Value[OutboxEmailStatus.Pending].Should().Be(1);
        result.Value[OutboxEmailStatus.Cancelled].Should().Be(1);
    }

    [Fact]
    public void Purgeable_MatchesOnlySentRowsOlderThanTheCutoff()
    {
        // The delete itself uses ExecuteDeleteAsync, which the EF InMemory provider this suite
        // runs on does not support -- so the RULE is what is tested here, and the integration
        // suite proves the delete. This goes red if someone swaps SentAt for CreatedAt or drops
        // the status check.
        // Arrange
        var cutoff = new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc);

        OutboxEmail Sent(int id, DateTime? sentAt, OutboxEmailStatus status = OutboxEmailStatus.Sent)
        {
            var email = MakeEmail(id, status);
            email.SentAt = sentAt;
            // Old enough to be caught if CreatedAt were ever used as the clock by mistake.
            email.CreatedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            return email;
        }

        var rows = new[]
        {
            Sent(1, cutoff.AddDays(-1)),                                  // old and sent
            Sent(2, cutoff.AddDays(1)),                                   // sent, but recent
            Sent(3, null, OutboxEmailStatus.Pending),                     // never sent
            Sent(4, cutoff.AddDays(-1), OutboxEmailStatus.Failed),        // failed, keep it
            Sent(5, cutoff.AddDays(-1), OutboxEmailStatus.Cancelled),     // cancelled, keep it
            Sent(6, null),                                                // Sent with no SentAt
        };

        // Act
        var matched = rows.AsQueryable().Where(MailOutboxRepository.Purgeable(cutoff)).ToList();

        // Assert
        matched.Select(e => e.Identifier).Should().BeEquivalentTo(["mail-1"]);
    }

    [Fact]
    public void PurgeableSettled_MatchesOnlyFailedAndCancelledRowsSettledBeforeTheCutoff()
    {
        // Same shape as Purgeable and for the same reason: ExecuteDeleteAsync cannot run on the
        // InMemory provider, so the RULE is what is held to account here and the integration
        // suite proves the delete.
        //
        // SettledAt is the clock and not LastUpdatedAt. Every row below carries a LastUpdatedAt
        // far older than the cutoff, so a predicate that reached for it would match nearly all
        // of them.
        // Arrange
        var cutoff = new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc);

        OutboxEmail Row(int id, OutboxEmailStatus status, DateTime? settledAt)
        {
            var email = MakeEmail(id, status, settledAt: settledAt);
            email.LastUpdatedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            email.CreatedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            return email;
        }

        var rows = new[]
        {
            Row(1, OutboxEmailStatus.Failed, cutoff.AddDays(-1)),       // settled long ago
            Row(2, OutboxEmailStatus.Cancelled, cutoff.AddDays(-1)),    // ditto
            Row(3, OutboxEmailStatus.Failed, cutoff.AddDays(1)),        // settled recently
            Row(4, OutboxEmailStatus.Failed, null),                     // no settle time: spared
            Row(5, OutboxEmailStatus.Sent, cutoff.AddDays(-1)),         // Purgeable's business
            Row(6, OutboxEmailStatus.Pending, cutoff.AddDays(-1)),      // still going out
            Row(7, OutboxEmailStatus.Sending, cutoff.AddDays(-1)),      // on the wire right now
        };

        // Act
        var matched = rows.AsQueryable()
            .Where(MailOutboxRepository.PurgeableSettled(cutoff)).ToList();

        // Assert
        matched.Select(e => e.Identifier).Should().BeEquivalentTo(["mail-1", "mail-2"]);
    }

    [Fact]
    public void RedactableBody_SkipsRowsAlreadyRedactedAndRowsStillSendable()
    {
        // Arrange
        var cutoff = new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc);

        var rows = new[]
        {
            MakeEmail(1, OutboxEmailStatus.Failed, settledAt: cutoff.AddDays(-1)),
            MakeEmail(2, OutboxEmailStatus.Cancelled, settledAt: cutoff.AddDays(-1)),
            // Already done. Without this clause the sweep rewrites the same rows every hour and
            // reports work it did not do.
            MakeEmail(3, OutboxEmailStatus.Failed, settledAt: cutoff.AddDays(-1),
                redactedAt: cutoff.AddDays(-1)),
            // Inside the window: an operator who has just fixed DNS can still retry this.
            MakeEmail(4, OutboxEmailStatus.Failed, settledAt: cutoff.AddDays(1)),
            MakeEmail(5, OutboxEmailStatus.Failed, settledAt: null),
            // Pending and Sending still have to go out, so their bodies are untouchable.
            MakeEmail(6, OutboxEmailStatus.Pending, settledAt: cutoff.AddDays(-1)),
            MakeEmail(7, OutboxEmailStatus.Sending, settledAt: cutoff.AddDays(-1)),
            // Sent rows are redacted by MarkSentAsync as they are marked, not here.
            MakeEmail(8, OutboxEmailStatus.Sent, settledAt: cutoff.AddDays(-1)),
        };

        // Act
        var matched = rows.AsQueryable()
            .Where(MailOutboxRepository.RedactableBody(cutoff)).ToList();

        // Assert
        matched.Select(e => e.Identifier).Should().BeEquivalentTo(["mail-1", "mail-2"]);
    }

    [Fact]
    public async Task ClaimAsync_WhenPending_MovesItToSending()
    {
        // Arrange
        var repo = Build(CreateSeededFactory(Seed(MakeEmail(1))));

        // Act
        var result = await repo.ClaimAsync(1, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Status.Should().Be(OutboxEmailStatus.Sending);
    }

    [Fact]
    public async Task ClaimAsync_WhenAlreadyClaimed_ReturnsConflict()
    {
        // Arrange - this is the duplicate queue signal. The second claim must find nothing to
        // do, which is what stops the same mail being sent twice.
        var repo = Build(CreateSeededFactory(Seed(MakeEmail(1))));
        await repo.ClaimAsync(1, TestContext.Current.CancellationToken);

        // Act
        var second = await repo.ClaimAsync(1, TestContext.Current.CancellationToken);

        // Assert
        second.IsSuccess.Should().BeFalse();
        second.Status.Should().Be(RepositoryResultStatus.Conflict);
    }

    [Fact]
    public async Task ClaimAsync_WhenAlreadySent_ReturnsConflict()
    {
        // Arrange
        var repo = Build(CreateSeededFactory(Seed(MakeEmail(1, OutboxEmailStatus.Sent))));

        // Act
        var result = await repo.ClaimAsync(1, TestContext.Current.CancellationToken);

        // Assert
        result.Status.Should().Be(RepositoryResultStatus.Conflict);
    }

    [Fact]
    public async Task ClaimAsync_WhenTheRowDoesNotExist_ReturnsNotFound()
    {
        // Arrange
        var repo = Build(CreateSeededFactory());

        // Act
        var result = await repo.ClaimAsync(404, TestContext.Current.CancellationToken);

        // Assert
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task MarkSentAsync_RecordsTheTimeAndClearsTheLastError()
    {
        // Arrange
        var factory = CreateSeededFactory(Seed(MakeEmail(1, OutboxEmailStatus.Sending)));
        var repo = Build(factory);

        // Act
        var result = await repo.MarkSentAsync(1, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        using var db = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var stored = db.OutboxEmails.Single(e => e.Id == 1);
        stored.Status.Should().Be(OutboxEmailStatus.Sent);
        stored.SentAt.Should().NotBeNull();
        stored.LastError.Should().BeNull();
    }

    [Fact]
    public async Task MarkSentAsync_ClearsTheRenderedBodies()
    {
        // A sent mail can never be retried, so nothing needs its body -- while the body still
        // holds a nickname and, for reset-password, a working link. Clearing it here rather than
        // on a timer means there is no window where a delivered mail's body sits in the table.
        // Arrange
        var factory = CreateSeededFactory(Seed(MakeEmail(1, OutboxEmailStatus.Sending)));
        var repo = Build(factory);

        // Act
        var result = await repo.MarkSentAsync(1, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        using var db = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var stored = db.OutboxEmails.Single(e => e.Id == 1);
        stored.BodyHtml.Should().BeEmpty();
        stored.BodyText.Should().BeEmpty();
        // RedactedAt, not the emptiness, is what every reader branches on.
        stored.RedactedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task MarkFailedAsync_WhenParked_RecordsWhenItSettled()
    {
        // Arrange
        var factory = CreateSeededFactory(Seed(MakeEmail(1, OutboxEmailStatus.Sending)));
        var repo = Build(factory);

        // Act
        var result = await repo.MarkFailedAsync(
            1, "550: no such mailbox", permanent: true, MaxAttempts, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Status.Should().Be(OutboxEmailStatus.Failed);
        result.Value.SettledAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task MarkFailedAsync_WhenItWillBeRetried_DoesNotRecordASettleTime()
    {
        // The retention clock must not start on a mail that is still going to be sent. This is
        // the half of the SettledAt rule that a test on the parking branch alone would miss.
        // Arrange
        var factory = CreateSeededFactory(Seed(MakeEmail(1, OutboxEmailStatus.Sending)));
        var repo = Build(factory);

        // Act
        var result = await repo.MarkFailedAsync(
            1, "connection refused", permanent: false, MaxAttempts, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Status.Should().Be(OutboxEmailStatus.Pending);
        result.Value.SettledAt.Should().BeNull();
    }

    [Fact]
    public async Task CancelAsync_RecordsWhenItSettled()
    {
        // Arrange
        var factory = CreateSeededFactory(Seed(MakeEmail(1, OutboxEmailStatus.Pending)));
        var repo = Build(factory);

        // Act
        var result = await repo.CancelAsync("mail-1", TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.SettledAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Theory]
    [InlineData(0, 1)]   // first failure  -> 1 minute
    [InlineData(1, 2)]   // second         -> 2
    [InlineData(2, 4)]   // third          -> 4
    [InlineData(3, 8)]   // fourth         -> 8
    public async Task MarkFailedAsync_WhenTransientAndUnderTheCap_BacksOffExponentially(
        int attemptsSoFar, int expectedMinutes)
    {
        // Arrange
        var factory = CreateSeededFactory(Seed(MakeEmail(1, OutboxEmailStatus.Sending, attempts: attemptsSoFar)));
        var repo = Build(factory);
        var before = DateTime.UtcNow;

        // Act
        var result = await repo.MarkFailedAsync(1, "connection refused", permanent: false, MaxAttempts, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Status.Should().Be(OutboxEmailStatus.Pending);
        result.Value.Attempts.Should().Be(attemptsSoFar + 1);
        result.Value.NextAttemptAt.Should().BeCloseTo(before.AddMinutes(expectedMinutes), TimeSpan.FromSeconds(30));
    }

    [Fact]
    public async Task MarkFailedAsync_WhenTheAttemptCapIsReached_ParksItAsFailed()
    {
        // Arrange - the fifth failure of five.
        var factory = CreateSeededFactory(Seed(MakeEmail(1, OutboxEmailStatus.Sending, attempts: MaxAttempts - 1)));
        var repo = Build(factory);

        // Act
        var result = await repo.MarkFailedAsync(1, "still refused", permanent: false, MaxAttempts, TestContext.Current.CancellationToken);

        // Assert
        result.Value.Should().NotBeNull();
        result.Value.Status.Should().Be(OutboxEmailStatus.Failed);
        result.Value.Attempts.Should().Be(MaxAttempts);
        result.Value.LastError.Should().Be("still refused");
    }

    [Fact]
    public async Task MarkFailedAsync_WhenPermanent_ParksItOnTheFirstAttempt()
    {
        // Arrange - a 5xx reply means retrying asks the same question and gets the same
        // answer, so the remaining four attempts are not spent.
        var factory = CreateSeededFactory(Seed(MakeEmail(1, OutboxEmailStatus.Sending)));
        var repo = Build(factory);

        // Act
        var result = await repo.MarkFailedAsync(1, "550: no such mailbox", permanent: true, MaxAttempts, TestContext.Current.CancellationToken);

        // Assert
        result.Value.Should().NotBeNull();
        result.Value.Status.Should().Be(OutboxEmailStatus.Failed);
        result.Value.Attempts.Should().Be(1);
    }

    [Fact]
    public async Task ReleaseAsync_PutsItBackWithoutCountingAnAttempt()
    {
        // Arrange - claimed, then found not to be due yet. Nothing was tried, so nothing may
        // be charged against the retry budget or the backoff it is already serving.
        var due = DateTime.UtcNow.AddMinutes(10);
        var factory = CreateSeededFactory(Seed(MakeEmail(1, OutboxEmailStatus.Sending, nextAttemptAt: due, attempts: 2)));
        var repo = Build(factory);

        // Act
        var result = await repo.ReleaseAsync(1, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        using var db = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var stored = db.OutboxEmails.Single(e => e.Id == 1);
        stored.Status.Should().Be(OutboxEmailStatus.Pending);
        stored.Attempts.Should().Be(2);
        stored.NextAttemptAt.Should().BeCloseTo(due, TimeSpan.FromSeconds(1));
        stored.LastError.Should().BeNull();
    }

    [Fact]
    public async Task ResetInterruptedAsync_MovesSendingBackToPendingAndLeavesEverythingElse()
    {
        // Arrange - a restart orphaned row 1. Nothing holds it: the queue died with the process.
        var factory = CreateSeededFactory(Seed(
            MakeEmail(1, OutboxEmailStatus.Sending),
            MakeEmail(2, OutboxEmailStatus.Sent),
            MakeEmail(3, OutboxEmailStatus.Failed),
            MakeEmail(4, OutboxEmailStatus.Pending)));
        var repo = Build(factory);

        // Act
        var result = await repo.ResetInterruptedAsync(TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be(1);

        using var db = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        db.OutboxEmails.Single(e => e.Id == 1).Status.Should().Be(OutboxEmailStatus.Pending);
        db.OutboxEmails.Single(e => e.Id == 2).Status.Should().Be(OutboxEmailStatus.Sent);
        db.OutboxEmails.Single(e => e.Id == 3).Status.Should().Be(OutboxEmailStatus.Failed);
    }

    [Fact]
    public async Task GetPendingIdsAsync_IncludesRowsWhoseBackoffHasNotExpired()
    {
        // Arrange - the startup sweep re-signals everything outstanding. A row still serving a
        // backoff is rescheduled by the dispatcher, not skipped here: leaving it out would
        // strand it until the next restart.
        var factory = CreateSeededFactory(Seed(
            MakeEmail(1, OutboxEmailStatus.Pending, nextAttemptAt: DateTime.UtcNow.AddMinutes(-1)),
            MakeEmail(2, OutboxEmailStatus.Pending, nextAttemptAt: DateTime.UtcNow.AddMinutes(30)),
            MakeEmail(3, OutboxEmailStatus.Sent)));
        var repo = Build(factory);

        // Act
        var result = await repo.GetPendingIdsAsync(TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEquivalentTo([1, 2]);
    }

    [Fact]
    public async Task AddAsync_PersistsTheRowAsPending()
    {
        // Arrange
        var factory = CreateSeededFactory();
        var repo = Build(factory);

        // Act
        var result = await repo.AddAsync(MakeEmail(0), TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        using var db = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        db.OutboxEmails.Should().ContainSingle(e => e.Status == OutboxEmailStatus.Pending);
    }
}
