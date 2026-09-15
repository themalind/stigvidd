// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace UnitTests.RepositoryTests;

public class PasswordResetTokenRepositoryTests : TestBase
{
    // Seeded by Utilities.GetSeedingUsers (User 1).
    private const string SeededEmail = "natur@example.local";
    private const int SeededUserId = 1;

    private static PasswordResetTokenRepository Build(IDbContextFactory<StigViddDbContext> factory) =>
        new(factory, NullLogger<PasswordResetTokenRepository>.Instance);

    private static PasswordResetToken NewToken(string hash, DateTime? consumedAt = null) => new()
    {
        UserId = SeededUserId,
        TokenHash = hash,
        ExpiresAt = DateTime.UtcNow.AddHours(2),
        ConsumedAt = consumedAt,
        CreatedAt = DateTime.UtcNow,
        LastUpdatedAt = DateTime.UtcNow,
    };

    [Fact]
    public async Task GetUserByEmailAsync_MatchesCaseInsensitively()
    {
        // Arrange — Keycloak lower-cases what it stores, and a user retyping their own address
        // with different capitalisation is not a different person.
        var factory = CreateSeededFactory();

        // Act
        var result = await Build(factory)
            .GetUserByEmailAsync(SeededEmail.ToUpperInvariant(), TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Id.Should().Be(SeededUserId);
    }

    [Fact]
    public async Task GetUserByEmailAsync_ForAnUnknownAddress_IsNotFoundRatherThanAnError()
    {
        var result = await Build(CreateSeededFactory())
            .GetUserByEmailAsync("nobody@example.local", TestContext.Current.CancellationToken);

        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task ReplaceOutstandingAsync_RetiresEveryLiveRowAndAddsTheNewOne()
    {
        // Arrange — two live links for one user would mean a superseded mail still works.
        var factory = CreateSeededFactory(db =>
        {
            db.PasswordResetTokens.Add(NewToken("first"));
            db.PasswordResetTokens.Add(NewToken("second"));
        });

        // Act
        var result = await Build(factory).ReplaceOutstandingAsync(NewToken("third"), TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();

        await using var db = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var rows = await db.PasswordResetTokens.ToListAsync(TestContext.Current.CancellationToken);

        rows.Should().HaveCount(3);
        rows.Where(r => r.ConsumedAt is null).Should().ContainSingle()
            .Which.TokenHash.Should().Be("third", "only the newest link may still be usable");
    }

    [Fact]
    public async Task ReplaceOutstandingAsync_LeavesAlreadyConsumedRowsAlone()
    {
        // Arrange — a spent row keeps the timestamp it was spent at; rewriting it would lose
        // the only record of when the password was actually changed.
        var spentAt = DateTime.UtcNow.AddDays(-1);
        var factory = CreateSeededFactory(db => db.PasswordResetTokens.Add(NewToken("old", consumedAt: spentAt)));

        // Act
        await Build(factory).ReplaceOutstandingAsync(NewToken("new"), TestContext.Current.CancellationToken);

        // Assert
        await using var db = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var old = await db.PasswordResetTokens.SingleAsync(r => r.TokenHash == "old", TestContext.Current.CancellationToken);
        old.ConsumedAt.Should().BeCloseTo(spentAt, TimeSpan.FromSeconds(1));
    }

    [Fact]
    public async Task GetByTokenHashAsync_LoadsTheOwningUser()
    {
        // Arrange — the reset needs the user's SubjectId to reach Keycloak, so a row without
        // its user loaded is unusable.
        var factory = CreateSeededFactory(db => db.PasswordResetTokens.Add(NewToken("a-hash")));

        // Act
        var result = await Build(factory).GetByTokenHashAsync("a-hash", TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.User.Should().NotBeNull();
        result.Value.User!.SubjectId.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task GetByTokenHashAsync_ReturnsConsumedRowsToo()
    {
        // Arrange — a spent link must be reportable as "already used" rather than "unknown".
        var factory = CreateSeededFactory(db =>
            db.PasswordResetTokens.Add(NewToken("spent", consumedAt: DateTime.UtcNow.AddMinutes(-5))));

        // Act
        var result = await Build(factory).GetByTokenHashAsync("spent", TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.ConsumedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task ConsumeAsync_StampsTheRow()
    {
        // Arrange
        var factory = CreateSeededFactory(db => db.PasswordResetTokens.Add(NewToken("a-hash")));
        var at = DateTime.UtcNow;

        await using var read = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var id = (await read.PasswordResetTokens.SingleAsync(TestContext.Current.CancellationToken)).Id;

        // Act
        var result = await Build(factory).ConsumeAsync(id, at, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();

        await using var db = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var row = await db.PasswordResetTokens.SingleAsync(TestContext.Current.CancellationToken);
        row.ConsumedAt.Should().BeCloseTo(at, TimeSpan.FromSeconds(1));
    }

    [Fact]
    public async Task GetLatestForUserAsync_ReturnsTheMostRecentlyIssuedRow()
    {
        // Arrange — this is what the resend cooldown is measured from, so "latest" must mean
        // latest issued, consumed or not.
        var factory = CreateSeededFactory(db =>
        {
            var older = NewToken("older", consumedAt: DateTime.UtcNow);
            older.CreatedAt = DateTime.UtcNow.AddHours(-3);
            db.PasswordResetTokens.Add(older);

            var newer = NewToken("newer");
            newer.CreatedAt = DateTime.UtcNow.AddMinutes(-1);
            db.PasswordResetTokens.Add(newer);
        });

        // Act
        var result = await Build(factory).GetLatestForUserAsync(SeededUserId, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TokenHash.Should().Be("newer");
    }
}
