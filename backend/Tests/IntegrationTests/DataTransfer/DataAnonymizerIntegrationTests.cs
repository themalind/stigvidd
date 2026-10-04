// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Services;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.Extensions.DependencyInjection;
using StigviddAPI;

namespace IntegrationTests.DataTransfer;

// On SQLite because the unit suite's InMemory provider has no ExecuteUpdateAsync. keep-comment: why these are integration tests
public class DataAnonymizerIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private const string NaturElskarenIdentifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
    private const string ModeratorName = "Greta Granskare";

    private readonly StigViddWebApplicationFactory<Program> _factory;

    public DataAnonymizerIntegrationTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    private StigViddDbContext NewContext() =>
        _factory.Services.GetRequiredService<IDbContextFactory<StigViddDbContext>>().CreateDbContext();

    private int SeedPersonalData()
    {
        using var db = NewContext();
        var user = db.Users.Single(u => u.Identifier == NaturElskarenIdentifier);

        db.UserPushTokens.Add(new UserPushToken { UserId = user.Id, ExpoToken = "ExponentPushToken[real-device]", Platform = "ios" });
        db.EmailVerificationTokens.Add(new EmailVerificationToken
        {
            UserId = user.Id, TokenHash = "verify-hash", CodeHash = "code-hash", ExpiresAt = DateTime.UtcNow.AddHours(1),
        });
        db.PasswordResetTokens.Add(new PasswordResetToken { UserId = user.Id, TokenHash = "reset-hash", ExpiresAt = DateTime.UtcNow.AddHours(1) });
        db.OutboxEmails.Add(new OutboxEmail
        {
            ToAddress = user.Email, ToName = user.NickName, Subject = "Välkommen",
            BodyHtml = "<p>Hej NaturElskaren</p>", BodyText = "Hej NaturElskaren",
            Status = OutboxEmailStatus.Pending, NextAttemptAt = DateTime.UtcNow,
        });
        db.ContentReports.Add(new ContentReport
        {
            ContentType = ReportedContentType.Review, ContentId = 1, ContentIdentifier = Guid.NewGuid().ToString(),
            Reason = ReportReason.Other, ContentSnapshot = "NaturElskaren skrev något", AuthorNickNameSnapshot = user.NickName,
            ContentAuthorUserId = user.Id, ReporterUserId = user.Id, ReporterNote = "Ring mig på 070-1234567",
            DecidedBy = ModeratorName, DecidedAt = DateTime.UtcNow, DecisionNote = "Pratade med NaturElskaren",
        });
        db.UserBans.Add(new UserBan { UserId = user.Id, BannedBy = ModeratorName, Reason = "Hotade Greta", LiftedBy = ModeratorName, LiftedAt = DateTime.UtcNow });

        var session = new TrailImportSession
        {
            Source = "boras-stad", FileName = "leder.geojson", FileHash = "hash", StoredPath = "/tmp/leder.geojson", UploadedBy = ModeratorName,
        };
        db.TrailImportSessions.Add(session);
        db.SaveChanges();

        db.TrailImportProposals.AddRange(
            new TrailImportProposal
            {
                SessionId = session.Id, ExternalId = "1", FeatureName = "Led 1", GeometryFingerprint = "a",
                FeatureProperties = "{}", FeatureGeometry = Utilities.GeoPath(), DecidedBy = ModeratorName, DecidedAt = DateTime.UtcNow,
            },
            new TrailImportProposal
            {
                SessionId = session.Id, ExternalId = "2", FeatureName = "Led 2", GeometryFingerprint = "b",
                FeatureProperties = "{}", FeatureGeometry = Utilities.GeoPath(), DecidedBy = "an earlier import", DecidedAt = DateTime.UtcNow,
            });

        var trails = db.Trails.OrderBy(t => t.Id).Take(2).ToList();
        trails[0].CreatedBy = user.Identifier;
        trails[1].CreatedBy = "boras-stad";
        db.SaveChanges();

        return user.Id;
    }

    private async Task AnonymizeAsync()
    {
        await using var db = NewContext();
        await DataAnonymizer.AnonymizeAsync(db, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task Anonymize_LeavesNoSeededNameAddressOrSubjectAnywhere()
    {
        // Arrange
        SeedPersonalData();
        string[] personal;
        await using (var before = NewContext())
        {
            var users = await before.Users.ToListAsync(TestContext.Current.CancellationToken);
            personal = [.. users.SelectMany(u => new[] { u.NickName, u.Email, u.SubjectId, u.Identifier })];
        }
        personal = [.. personal, ModeratorName, "070-1234567", "Hotade Greta"];

        // Act
        await AnonymizeAsync();

        // Assert
        await using var db = NewContext();
        var text = await AllTextAsync(db);
        foreach (var value in personal)
            text.Should().NotContain(value);
    }

    [Fact]
    public async Task Anonymize_EmptiesTheContactAndSecretTables()
    {
        // Arrange
        SeedPersonalData();

        // Act
        await AnonymizeAsync();

        // Assert
        await using var db = NewContext();
        (await db.UserPushTokens.CountAsync(TestContext.Current.CancellationToken)).Should().Be(0);
        (await db.EmailVerificationTokens.CountAsync(TestContext.Current.CancellationToken)).Should().Be(0);
        (await db.PasswordResetTokens.CountAsync(TestContext.Current.CancellationToken)).Should().Be(0);
        (await db.OutboxEmails.CountAsync(TestContext.Current.CancellationToken)).Should().Be(0);
    }

    [Fact]
    public async Task Anonymize_PointsCreatedByAtTheSameUsersNewIdentifier()
    {
        // Arrange
        var userId = SeedPersonalData();

        // Act
        await AnonymizeAsync();

        // Assert
        await using var db = NewContext();
        var user = await db.Users.SingleAsync(u => u.Id == userId, TestContext.Current.CancellationToken);
        user.NickName.Should().Be($"user-{userId}");
        user.Email.Should().Be($"user-{userId}@example.invalid");

        var hikes = await db.Hikes.Where(h => h.UserId == userId).ToListAsync(TestContext.Current.CancellationToken);
        hikes.Should().NotBeEmpty();
        hikes.Should().AllSatisfy(h =>
        {
            h.CreatedBy.Should().Be(user.Identifier);
            h.CreatedByNickName.Should().Be(user.NickName);
        });

        var trails = await db.Trails.OrderBy(t => t.Id).Take(2).ToListAsync(TestContext.Current.CancellationToken);
        trails[0].CreatedBy.Should().Be(user.Identifier);
        trails[1].CreatedBy.Should().Be("boras-stad");
    }

    [Fact]
    public async Task Anonymize_KeepsTheContentItWasToldToKeep()
    {
        // Arrange
        SeedPersonalData();
        int hikes, reviews, trails;
        string[] reviewTexts;
        await using (var before = NewContext())
        {
            hikes = await before.Hikes.CountAsync(TestContext.Current.CancellationToken);
            reviews = await before.Reviews.CountAsync(TestContext.Current.CancellationToken);
            trails = await before.Trails.CountAsync(TestContext.Current.CancellationToken);
            reviewTexts = await before.Reviews.OrderBy(r => r.Id).Select(r => r.TrailReview ?? "").ToArrayAsync(TestContext.Current.CancellationToken);
        }

        // Act
        await AnonymizeAsync();

        // Assert
        await using var db = NewContext();
        (await db.Hikes.CountAsync(TestContext.Current.CancellationToken)).Should().Be(hikes);
        (await db.Reviews.CountAsync(TestContext.Current.CancellationToken)).Should().Be(reviews);
        (await db.Trails.CountAsync(TestContext.Current.CancellationToken)).Should().Be(trails);
        (await db.Reviews.OrderBy(r => r.Id).Select(r => r.TrailReview ?? "").ToArrayAsync(TestContext.Current.CancellationToken))
            .Should().Equal(reviewTexts);
        (await db.TrailImportProposals.Select(p => p.DecidedBy).ToListAsync(TestContext.Current.CancellationToken))
            .Should().BeEquivalentTo([DataAnonymizer.Moderator, "an earlier import"]);
    }

    [Fact]
    public async Task NeutralizeOutbound_ClearsEveryWayToReachAPersonAndNothingElse()
    {
        // Arrange
        var userId = SeedPersonalData();
        await using (var seed = NewContext())
        {
            seed.OutboxEmails.Add(new OutboxEmail
            {
                ToAddress = "natur@example.local", Subject = "Skickat", BodyHtml = "", BodyText = "",
                Status = OutboxEmailStatus.Sent, NextAttemptAt = DateTime.UtcNow, SentAt = DateTime.UtcNow,
            });
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        // Act
        await using (var act = NewContext())
            await DataAnonymizer.NeutralizeOutboundAsync(act, TestContext.Current.CancellationToken);

        // Assert
        await using var db = NewContext();
        (await db.UserPushTokens.CountAsync(TestContext.Current.CancellationToken)).Should().Be(0);
        (await db.EmailVerificationTokens.CountAsync(TestContext.Current.CancellationToken)).Should().Be(0);
        (await db.PasswordResetTokens.CountAsync(TestContext.Current.CancellationToken)).Should().Be(0);
        (await db.OutboxEmails.Select(m => m.Status).ToListAsync(TestContext.Current.CancellationToken))
            .Should().Equal(OutboxEmailStatus.Sent);
        var user = await db.Users.SingleAsync(u => u.Id == userId, TestContext.Current.CancellationToken);
        user.Email.Should().Be("natur@example.local");
    }

    [Fact]
    public void Classification_CoversEveryColumnOfEveryTable()
    {
        using var db = NewContext();

        var unclassified = new List<string>();
        foreach (var entity in db.Model.GetEntityTypes().Where(e => !e.IsOwned()))
        {
            var table = entity.GetTableName();
            if (table is null || DataAnonymizer.EmptiedTables.Contains(table))
                continue;

            if (!DataAnonymizer.Columns.TryGetValue(table, out var columns))
            {
                unclassified.Add(table);
                continue;
            }

            unclassified.AddRange(entity.GetProperties()
                .Where(p => !columns.ContainsKey(p.Name))
                .Select(p => $"{table}.{p.Name}"));
        }

        unclassified.Should().BeEmpty(
            "every column must be classified in DataAnonymizer before it can reach an anonymized export");
    }

    private static async Task<string> AllTextAsync(StigViddDbContext db)
    {
        var connection = db.Database.GetDbConnection();
        if (connection.State != System.Data.ConnectionState.Open)
            await connection.OpenAsync(TestContext.Current.CancellationToken);

        var text = new System.Text.StringBuilder();
        foreach (var entity in db.Model.GetEntityTypes())
        {
            var table = entity.GetTableName();
            if (table is null)
                continue;

            await using var command = connection.CreateCommand();
            command.CommandText = $"SELECT * FROM \"{table}\"";
            await using var reader = await command.ExecuteReaderAsync(TestContext.Current.CancellationToken);
            while (await reader.ReadAsync(TestContext.Current.CancellationToken))
            {
                for (var i = 0; i < reader.FieldCount; i++)
                    text.Append(reader.IsDBNull(i) ? "" : reader.GetValue(i).ToString()).Append('|');
            }
        }

        return text.ToString();
    }
}
