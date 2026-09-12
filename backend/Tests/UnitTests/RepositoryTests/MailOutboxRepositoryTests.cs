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
        int attempts = 0) =>
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
            CreatedAt = Utilities.SeedDates.Created,
            LastUpdatedAt = Utilities.SeedDates.Updated,
        };

    private static Action<StigViddDbContext> Seed(params OutboxEmail[] emails) =>
        db => db.OutboxEmails.AddRange(emails);

    [Fact]
    public async Task ClaimAsync_WhenPending_MovesItToSending()
    {
        // Arrange
        var repo = Build(CreateSeededFactory(Seed(MakeEmail(1))));

        // Act
        var result = await repo.ClaimAsync(1, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(OutboxEmailStatus.Sending);
    }

    [Fact]
    public async Task ClaimAsync_WhenAlreadyClaimed_ReturnsConflict()
    {
        // Arrange - this is the duplicate queue signal. The second claim must find nothing to
        // do, which is what stops the same mail being sent twice.
        var repo = Build(CreateSeededFactory(Seed(MakeEmail(1))));
        await repo.ClaimAsync(1, CancellationToken.None);

        // Act
        var second = await repo.ClaimAsync(1, CancellationToken.None);

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
        var result = await repo.ClaimAsync(1, CancellationToken.None);

        // Assert
        result.Status.Should().Be(RepositoryResultStatus.Conflict);
    }

    [Fact]
    public async Task ClaimAsync_WhenTheRowDoesNotExist_ReturnsNotFound()
    {
        // Arrange
        var repo = Build(CreateSeededFactory());

        // Act
        var result = await repo.ClaimAsync(404, CancellationToken.None);

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
        var result = await repo.MarkSentAsync(1, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        using var db = await factory.CreateDbContextAsync();
        var stored = db.OutboxEmails.Single(e => e.Id == 1);
        stored.Status.Should().Be(OutboxEmailStatus.Sent);
        stored.SentAt.Should().NotBeNull();
        stored.LastError.Should().BeNull();
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
        var result = await repo.MarkFailedAsync(1, "connection refused", permanent: false, MaxAttempts, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(OutboxEmailStatus.Pending);
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
        var result = await repo.MarkFailedAsync(1, "still refused", permanent: false, MaxAttempts, CancellationToken.None);

        // Assert
        result.Value!.Status.Should().Be(OutboxEmailStatus.Failed);
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
        var result = await repo.MarkFailedAsync(1, "550: no such mailbox", permanent: true, MaxAttempts, CancellationToken.None);

        // Assert
        result.Value!.Status.Should().Be(OutboxEmailStatus.Failed);
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
        var result = await repo.ReleaseAsync(1, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        using var db = await factory.CreateDbContextAsync();
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
        var result = await repo.ResetInterruptedAsync(CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be(1);

        using var db = await factory.CreateDbContextAsync();
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
        var result = await repo.GetPendingIdsAsync(CancellationToken.None);

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
        var result = await repo.AddAsync(MakeEmail(0), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        using var db = await factory.CreateDbContextAsync();
        db.OutboxEmails.Should().ContainSingle(e => e.Status == OutboxEmailStatus.Pending);
    }
}
