// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;

namespace IntegrationTests.UsersController;

public class DeleteUserLeavesNoTraceTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private const int VandrarVennenId = 2;
    private const string Identifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";
    private const string Subject = "firebase-uid-12346";
    private const string Email = "vandrar@example.local";
    private const string NickName = "VandrarVennen";

    private readonly StigViddWebApplicationFactory<Program> _factory;

    public DeleteUserLeavesNoTraceTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();

        _factory.KeycloakAdminMock.Reset();
        _factory.KeycloakAdminMock
            .Setup(k => k.DeleteUserAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
    }

    private StigViddDbContext Db() =>
        _factory.Services.GetRequiredService<IDbContextFactory<StigViddDbContext>>().CreateDbContext();

    [Fact]
    public async Task DeleteUser_WithEverythingAUserCanHave_LeavesNoTraceOfThemInAnyTable()
    {
        // Arrange
        await SeedEverythingAsync();
        var before = await TracesAsync();
        before.Select(t => t.Table).Should().Contain(
        [
            "Users", "Hikes", "HikeShares", "Reviews", "TrailObstacles", "TrailObstacleSolvedVotes",
            "UserBlocks", "FriendRequests", "FriendNotes", "UserKeycloakMappings", "OutboxEmails", "UserPushTokens",
            "EmailVerificationTokens", "PasswordResetTokens", "UserBans", "ContentReports", "HikeSubmissions",
        ]);

        // Act
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", Subject);
        var response = await client.SendAsync(
            new HttpRequestMessage(HttpMethod.Delete, "/api/v1/users/delete"),
            TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        string.Join(", ", (await TracesAsync()).Select(t => $"{t.Table}.{t.Column}").Distinct()).Should().BeEmpty();
    }

    private async Task SeedEverythingAsync()
    {
        using var db = Db();
        var now = DateTime.UtcNow;

        db.UserBlocks.AddRange(
            new UserBlock { BlockerUserId = 1, BlockedUserId = VandrarVennenId },
            new UserBlock { BlockerUserId = VandrarVennenId, BlockedUserId = 3 });
        db.FriendRequests.Add(new FriendRequest { RequesterId = VandrarVennenId, ReceiverId = 3 });
        db.FriendNotes.AddRange(
            new FriendNote { OwnerUserId = VandrarVennenId, FriendUserId = 1, Text = "Kusin" },
            new FriendNote { OwnerUserId = 3, FriendUserId = VandrarVennenId, Text = "Grannen" });
        db.UserKeycloakMappings.Add(new UserKeycloakMapping
        {
            PackageUserId = VandrarVennenId,
            KeycloakSubjectId = "kc-vandrarvennen",
            KeycloakUsername = "vandrarvennen",
            NickName = NickName,
            Email = Email,
        });
        db.OutboxEmails.Add(new OutboxEmail
        {
            Identifier = Guid.NewGuid().ToString(),
            ToAddress = Email,
            ToName = NickName,
            Subject = "Välkommen",
            BodyHtml = "<p>Hej</p>",
            BodyText = "Hej",
            TemplateKey = "welcome",
            Status = OutboxEmailStatus.Sent,
            NextAttemptAt = now,
            SentAt = now,
        });
        db.UserPushTokens.Add(new UserPushToken { UserId = VandrarVennenId, ExpoToken = "ExponentPushToken[vandrar]", Platform = "ios" });
        db.EmailVerificationTokens.Add(new EmailVerificationToken
        {
            UserId = VandrarVennenId, TokenHash = "token-hash", CodeHash = "code-hash", ExpiresAt = now.AddHours(1),
        });
        db.PasswordResetTokens.Add(new PasswordResetToken { UserId = VandrarVennenId, TokenHash = "reset-hash", ExpiresAt = now.AddHours(1) });
        db.UserBans.Add(new UserBan { UserId = VandrarVennenId, BannedBy = "moderator", Reason = "Spam", LiftedAt = now, LiftedBy = "moderator" });
        db.ContentReports.AddRange(
            new ContentReport
            {
                ContentType = ReportedContentType.Review,
                ContentId = 1,
                ContentIdentifier = "r1a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c",
                ContentSnapshot = "Deras recensionstext",
                AuthorNickNameSnapshot = NickName,
                ContentAuthorUserId = VandrarVennenId,
                ReporterUserId = 1,
                Reason = ReportReason.Offensive,
            },
            new ContentReport
            {
                ContentType = ReportedContentType.Review,
                ContentId = 999,
                ContentIdentifier = "someone-elses-review",
                ContentAuthorUserId = 3,
                ReporterUserId = VandrarVennenId,
                ReporterNote = "Skrivet av VandrarVennen",
                Reason = ReportReason.Offensive,
            });
        db.HikeSubmissions.Add(new HikeSubmission
        {
            UserId = VandrarVennenId,
            Name = "Kvällsrunda",
            Description = "Runt sjön",
            GeoPath = Utilities.GeoPath((12.94, 57.72), (12.95, 57.73)),
            OriginalGeoPath = Utilities.GeoPath((12.94, 57.72), (12.95, 57.73)),
            TrailLength = 1.3m,
            Classification = 2,
            GettingThere = "Buss 3",
            TransferAcceptedAt = now,
            ConsentTextId = 1,
            Images = [new HikeSubmissionImage { ImageUrl = "trails/vandrar.jpeg", Width = 800, Height = 600 }],
        });

        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    // Raw SQL over every mapped table, so no query filter hides a row. keep-comment: why not DbSets
    private async Task<List<(string Table, string Column)>> TracesAsync()
    {
        var ctoken = TestContext.Current.CancellationToken;
        using var db = Db();
        await db.Database.OpenConnectionAsync(ctoken);
        var connection = db.Database.GetDbConnection();
        string[] needles = [Identifier, Subject, Email, NickName];
        var traces = new List<(string Table, string Column)>();

        foreach (var table in db.Model.GetEntityTypes().Where(e => e.GetTableName() is not null).GroupBy(e => e.GetTableName() ?? string.Empty))
        {
            var store = StoreObjectIdentifier.Table(table.Key, table.First().GetSchema());
            var userColumns = table
                .SelectMany(e => e.GetForeignKeys())
                .Where(fk => fk.PrincipalEntityType.ClrType == typeof(User))
                .SelectMany(fk => fk.Properties)
                .Select(p => p.GetColumnName(store))
                .OfType<string>()
                .ToHashSet();

            using var command = connection.CreateCommand();
            command.CommandText = $"SELECT * FROM \"{table.Key}\"";
            using var reader = await command.ExecuteReaderAsync(ctoken);

            while (await reader.ReadAsync(ctoken))
            {
                for (var i = 0; i < reader.FieldCount; i++)
                {
                    var column = reader.GetName(i);
                    var value = reader.GetValue(i);

                    var pointsAtThem = userColumns.Contains(column) && value is long id && id == VandrarVennenId;
                    var namesThem = value is string text && needles.Any(n => text.Contains(n, StringComparison.OrdinalIgnoreCase));

                    if (pointsAtThem || namesThem)
                        traces.Add((table.Key, column));
                }
            }
        }

        return traces;
    }
}
