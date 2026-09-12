// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace UnitTests.RepositoryTests;

public class EmailVerificationTokenRepositoryTests : TestBase
{
    // Seeded by Utilities.GetSeedingUsers (User 1).
    private const int SeededUserId = 1;
    private const string SeededEmail = "natur@example.local";

    private static EmailVerificationTokenRepository Build(IDbContextFactory<StigViddDbContext> factory) =>
        new(factory, NullLogger<EmailVerificationTokenRepository>.Instance);

    private static EmailVerificationToken MakeToken(
        int id,
        string tokenHash,
        DateTime? consumedAt = null,
        DateTime? createdAt = null,
        int attempts = 0) =>
        new()
        {
            Id = id,
            Identifier = $"verification-{id}",
            UserId = SeededUserId,
            TokenHash = tokenHash,
            CodeHash = $"code-hash-{id}",
            ExpiresAt = DateTime.UtcNow.AddHours(24),
            ConsumedAt = consumedAt,
            Attempts = attempts,
            CreatedAt = createdAt ?? DateTime.UtcNow,
            LastUpdatedAt = createdAt ?? DateTime.UtcNow,
        };

    private static Action<StigViddDbContext> Seed(params EmailVerificationToken[] tokens) =>
        db => db.EmailVerificationTokens.AddRange(tokens);

    [Fact]
    public async Task GetUserByEmailAsync_MatchesRegardlessOfCase()
    {
        // Arrange: Keycloak lower-cases what it stores, and a user retyping their own address
        // with different capitalisation is not a different person.
        var factory = CreateSeededFactory();

        // Act
        var result = await Build(factory).GetUserByEmailAsync("NATUR@Example.Local", CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Id.Should().Be(SeededUserId);
    }

    [Fact]
    public async Task GetUserByEmailAsync_WhenNoSuchAddress_ReturnsNotFound()
    {
        // Arrange
        var factory = CreateSeededFactory();

        // Act
        var result = await Build(factory).GetUserByEmailAsync("nobody@test.local", CancellationToken.None);

        // Assert
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task ReplaceOutstandingAsync_ConsumesEveryPreviousLiveTokenForThatUser()
    {
        // Arrange: a resend must retire the old challenge, or two codes are live at once.
        var factory = CreateSeededFactory(Seed(MakeToken(1, "old-hash")));

        // Act
        var result = await Build(factory).ReplaceOutstandingAsync(
            MakeToken(2, "new-hash"), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();

        using var db = await factory.CreateDbContextAsync(CancellationToken.None);
        db.EmailVerificationTokens.Single(t => t.Id == 1).ConsumedAt.Should().NotBeNull();
        db.EmailVerificationTokens.Single(t => t.Id == 2).ConsumedAt.Should().BeNull();
    }

    [Fact]
    public async Task GetByTokenHashAsync_LoadsTheOwningUser()
    {
        // Arrange: the service decides expiry and already-verified from the user, so a row
        // handed back without one would read as a server error.
        var factory = CreateSeededFactory(Seed(MakeToken(1, "the-hash")));

        // Act
        var result = await Build(factory).GetByTokenHashAsync("the-hash", CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.User.Should().NotBeNull();
        result.Value!.User!.Id.Should().Be(SeededUserId);
    }

    [Fact]
    public async Task GetByTokenHashAsync_ReturnsConsumedRowsToo()
    {
        // Arrange: a consumed row is how "already verified" is told apart from "never existed".
        var factory = CreateSeededFactory(Seed(MakeToken(1, "the-hash", consumedAt: DateTime.UtcNow)));

        // Act
        var result = await Build(factory).GetByTokenHashAsync("the-hash", CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.ConsumedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task GetLatestForUserAsync_ReturnsTheMostRecentlyIssuedRow()
    {
        // Arrange
        var older = MakeToken(1, "older", createdAt: DateTime.UtcNow.AddMinutes(-30));
        var newer = MakeToken(2, "newer", createdAt: DateTime.UtcNow.AddMinutes(-1));
        var factory = CreateSeededFactory(Seed(older, newer));

        // Act
        var result = await Build(factory).GetLatestForUserAsync(SeededUserId, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Id.Should().Be(2);
    }

    [Fact]
    public async Task ConsumeAsync_StampsBothTheTokenAndTheUser()
    {
        // Arrange: the two must not drift — a consumed token whose user still reads unverified
        // leaves that user unable to verify and unable to ask for another mail.
        var factory = CreateSeededFactory(Seed(MakeToken(1, "the-hash")));
        var verifiedAt = new DateTime(2026, 9, 12, 10, 0, 0, DateTimeKind.Utc);

        // Act
        var result = await Build(factory).ConsumeAsync(1, verifiedAt, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();

        using var db = await factory.CreateDbContextAsync(CancellationToken.None);
        db.EmailVerificationTokens.Single(t => t.Id == 1).ConsumedAt.Should().Be(verifiedAt);
        db.Users.Single(u => u.Id == SeededUserId).EmailVerifiedAt.Should().Be(verifiedAt);
    }

    [Fact]
    public async Task ConsumeAsync_WhenTheTokenIsGone_ReturnsNotFound()
    {
        // Arrange
        var factory = CreateSeededFactory();

        // Act
        var result = await Build(factory).ConsumeAsync(404, DateTime.UtcNow, CancellationToken.None);

        // Assert
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task IncrementAttemptsAsync_CountsUpAndReturnsTheNewTotal()
    {
        // Arrange
        var factory = CreateSeededFactory(Seed(MakeToken(1, "the-hash", attempts: 2)));

        // Act
        var result = await Build(factory).IncrementAttemptsAsync(1, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Should().Be(3);

        using var db = await factory.CreateDbContextAsync(CancellationToken.None);
        db.EmailVerificationTokens.Single(t => t.Id == 1).Attempts.Should().Be(3);
    }
}
