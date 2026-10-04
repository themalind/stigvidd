// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;

namespace Core.Services;

public enum ColumnTreatment
{
    Kept,
    Replaced,
    Cleared,
}

// Runs against a scratch copy of the database, never the live one. keep-comment: every statement here is destructive
public static class DataAnonymizer
{
    public const string Moderator = "moderator";

    // Emptied outright: contact channels and live secrets. keep-comment: why these tables are not scrubbed column by column
    public static readonly IReadOnlySet<string> EmptiedTables = new HashSet<string>
    {
        "UserPushTokens", "EmailVerificationTokens", "PasswordResetTokens", "OutboxEmails",
    };

    // Every column of every other table. ClassificationTests fails on any column missing here, so a new personal column cannot reach an anonymized export unreviewed. keep-comment: the guard this list exists for
    public static readonly IReadOnlyDictionary<string, IReadOnlyDictionary<string, ColumnTreatment>> Columns =
        new Dictionary<string, IReadOnlyDictionary<string, ColumnTreatment>>
        {
            ["Users"] = Table(
                kept: "Id CreatedAt LastUpdatedAt EmailVerifiedAt",
                replaced: "NickName Email SubjectId Identifier"),
            ["Hikes"] = Table(
                kept: "Id Identifier CreatedAt LastUpdatedAt Name Description ParkingInfo GettingThere GeoPath HikeLength Duration UserId",
                replaced: "CreatedBy CreatedByNickName"),
            ["Trails"] = Table(
                kept: "Id Identifier CreatedAt LastUpdatedAt Accessibility AccessibilityInfo City Classification Description FullDescription GeoPath IsVerified Name Tags TrailLength TrailSymbol TrailSymbolImage",
                replaced: "CreatedBy"),
            ["ContentReports"] = Table(
                kept: "Id Identifier CreatedAt LastUpdatedAt ContentType ContentId ContentIdentifier TrailId TrailIdentifier ContentAuthorUserId ReporterUserId Reason Status HideOutcome DecidedAt",
                replaced: "DecidedBy",
                cleared: "ContentSnapshot AuthorNickNameSnapshot ReporterNote DecisionNote"),
            ["UserBans"] = Table(
                kept: "Id UserId BannedAt LiftedAt",
                replaced: "BannedBy LiftedBy",
                cleared: "Reason"),
            ["TrailImportSessions"] = Table(
                kept: "Id Identifier CreatedAt LastUpdatedAt AnalyzedAt AppliedAt ApplyReport ErrorMessage FeatureCount FileHash FileName FileSizeBytes Source Status StoredPath",
                replaced: "UploadedBy"),
            ["TrailImportProposals"] = Table(
                kept: "Id Identifier CreatedAt LastUpdatedAt Confidence CoverageBackward CoverageForward CreatedTrailId DecidedAt DecidedLengthKm DecidedName DecidedRole DecidedTrailId Decision ExternalId FeatureGeometry FeatureName FeatureProperties GeometryFingerprint HausdorffMeters MatchReason NearestTrailId Note SessionId SuggestedTrailId",
                replaced: "DecidedBy"),
            ["Reviews"] = Table(kept: "Id Identifier CreatedAt LastUpdatedAt ModerationState Rating TrailId TrailReview UserId"),
            ["ReviewImages"] = Table(kept: "Id Identifier CreatedAt LastUpdatedAt ImageUrl ReviewId"),
            ["HikeImages"] = Table(kept: "Id Identifier CreatedAt LastUpdatedAt HikeId ImageUrl"),
            ["HikeShares"] = Table(kept: "HikeId SharedWithId AllowResharing CreatedAt SharedById Status"),
            ["FriendRequests"] = Table(kept: "RequesterId ReceiverId CreatedAt Status"),
            ["UserBlocks"] = Table(kept: "BlockerUserId BlockedUserId CreatedAt"),
            ["UserFavorites"] = Table(kept: "UserId TrailId"),
            ["UserWishList"] = Table(kept: "UserId TrailId"),
            ["TrailObstacles"] = Table(kept: "Id Identifier CreatedAt LastUpdatedAt Description IncidentLocation IssueType ModerationState TrailId UserId"),
            ["TrailObstacleSolvedVotes"] = Table(kept: "Id Identifier CreatedAt LastUpdatedAt TrailObstacleId UserId"),
            ["TrailImages"] = Table(kept: "Id Identifier CreatedAt LastUpdatedAt AltText Caption Height ImageUrl SizeBytes SortOrder TrailId Width"),
            ["TrailLinks"] = Table(kept: "Id Identifier CreatedAt LastUpdatedAt Link Title TrailId"),
            ["TrailRelations"] = Table(kept: "Id Identifier CreatedAt LastUpdatedAt FromTrailId Sequence ToTrailId Type"),
            ["TrailSourceLinks"] = Table(kept: "Id Identifier CreatedAt LastUpdatedAt Confidence ConfirmedByHuman GeometryFingerprint LastSeenAt LastSeenExternalId MissingImportCount MissingSinceAt Role Source SourceSnapshot TrailId"),
            ["VisitorInformations"] = Table(kept: "Id Identifier CreatedAt LastUpdatedAt GettingThere Illumination IlluminationText MaintainedBy Parking PublicTransport TrailId WinterMaintenance"),
            ["Facilities"] = Table(kept: "Id Identifier CreatedAt LastUpdatedAt Coordinates Description FacilityType IsAccessible Location Name Url"),
            ["FacilityImages"] = Table(kept: "Id Identifier CreatedAt LastUpdatedAt AltText Caption FacilityId Height ImageUrl SizeBytes SortOrder Width"),
            ["CityAreas"] = Table(kept: "Id Identifier CreatedAt LastUpdatedAt Description ImageUrl Location Name Url"),
            ["CityAreaTrail"] = Table(kept: "CityAreaId TrailId"),
            ["CityAreaFacility"] = Table(kept: "CityAreaId FacilityId"),
            ["MailTemplates"] = Table(kept: "Id Identifier CreatedAt LastUpdatedAt BodyHtml BodyText Description Key Language Subject"),
            ["MediaReprocessJobs"] = Table(kept: "Id Identifier CreatedAt LastUpdatedAt OptionsJson"),
            ["MediaReprocessItems"] = Table(kept: "Id Identifier CreatedAt LastUpdatedAt JobId LastError MediaIdentifier OwnerType Status"),
        };

    public static async Task AnonymizeAsync(StigViddDbContext db, CancellationToken ctoken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ctoken);

        await EmptyContactTablesAsync(db, ctoken);

        // Point CreatedBy at the user's Id first: the Identifier it holds today is about to be replaced. keep-comment: ordering constraint
        await db.Hikes.ExecuteUpdateAsync(s => s.SetProperty(
            h => h.CreatedBy,
            h => db.Users.Where(u => u.Identifier == h.CreatedBy).Select(u => "user:" + u.Id).FirstOrDefault() ?? h.CreatedBy), ctoken);
        await db.Trails.ExecuteUpdateAsync(s => s.SetProperty(
            t => t.CreatedBy,
            t => db.Users.Where(u => u.Identifier == t.CreatedBy).Select(u => "user:" + u.Id).FirstOrDefault() ?? t.CreatedBy), ctoken);

        var userIds = await db.Users.Select(u => u.Id).ToListAsync(ctoken);
        foreach (var id in userIds)
        {
            var identifier = Guid.NewGuid().ToString();
            var subjectId = Guid.NewGuid().ToString();

            await db.Users.Where(u => u.Id == id).ExecuteUpdateAsync(s => s
                .SetProperty(u => u.NickName, "user-" + id)
                .SetProperty(u => u.Email, "user-" + id + "@example.invalid")
                .SetProperty(u => u.SubjectId, subjectId)
                .SetProperty(u => u.Identifier, identifier), ctoken);
        }

        await db.Hikes.Where(h => h.CreatedBy != null && h.CreatedBy.StartsWith("user:")).ExecuteUpdateAsync(s => s.SetProperty(
            h => h.CreatedBy,
            h => db.Users.Where(u => "user:" + u.Id == h.CreatedBy).Select(u => u.Identifier).FirstOrDefault()), ctoken);
        await db.Trails.Where(t => t.CreatedBy != null && t.CreatedBy.StartsWith("user:")).ExecuteUpdateAsync(s => s.SetProperty(
            t => t.CreatedBy,
            t => db.Users.Where(u => "user:" + u.Id == t.CreatedBy).Select(u => u.Identifier).FirstOrDefault()), ctoken);

        await db.Hikes.ExecuteUpdateAsync(s => s.SetProperty(
            h => h.CreatedByNickName,
            h => db.Users.Where(u => u.Id == h.UserId).Select(u => u.NickName).FirstOrDefault()), ctoken);

        await db.ContentReports.ExecuteUpdateAsync(s => s
            .SetProperty(r => r.ContentSnapshot, (string?)null)
            .SetProperty(r => r.AuthorNickNameSnapshot, (string?)null)
            .SetProperty(r => r.ReporterNote, (string?)null)
            .SetProperty(r => r.DecisionNote, (string?)null)
            .SetProperty(r => r.DecidedBy, r => r.DecidedBy == null ? null : Moderator), ctoken);

        await db.UserBans.ExecuteUpdateAsync(s => s
            .SetProperty(b => b.Reason, (string?)null)
            .SetProperty(b => b.BannedBy, Moderator)
            .SetProperty(b => b.LiftedBy, b => b.LiftedBy == null ? null : Moderator), ctoken);

        await db.TrailImportSessions.Where(t => t.UploadedBy != null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.UploadedBy, Moderator), ctoken);

        // System-written values such as "an earlier import" name no person, and the analysis reads them back. keep-comment: why only human decisions are replaced
        await db.TrailImportProposals.Where(p => p.DecidedBy != null && p.DecidedAt != null && p.DecidedBy != "an earlier import")
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.DecidedBy, Moderator), ctoken);

        await transaction.CommitAsync(ctoken);
    }

    // For a copy of production on a host that shares production's mail server and push credentials. keep-comment: why a non-anonymized import still needs this
    public static async Task NeutralizeOutboundAsync(StigViddDbContext db, CancellationToken ctoken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ctoken);

        await db.OutboxEmails
            .Where(m => m.Status == OutboxEmailStatus.Pending || m.Status == OutboxEmailStatus.Sending)
            .ExecuteDeleteAsync(ctoken);
        await db.UserPushTokens.ExecuteDeleteAsync(ctoken);
        await db.EmailVerificationTokens.ExecuteDeleteAsync(ctoken);
        await db.PasswordResetTokens.ExecuteDeleteAsync(ctoken);

        await transaction.CommitAsync(ctoken);
    }

    private static async Task EmptyContactTablesAsync(StigViddDbContext db, CancellationToken ctoken)
    {
        await db.UserPushTokens.ExecuteDeleteAsync(ctoken);
        await db.EmailVerificationTokens.ExecuteDeleteAsync(ctoken);
        await db.PasswordResetTokens.ExecuteDeleteAsync(ctoken);
        await db.OutboxEmails.ExecuteDeleteAsync(ctoken);
    }

    private static IReadOnlyDictionary<string, ColumnTreatment> Table(string kept, string replaced = "", string cleared = "")
    {
        var columns = new Dictionary<string, ColumnTreatment>();

        foreach (var (names, treatment) in new[] { (kept, ColumnTreatment.Kept), (replaced, ColumnTreatment.Replaced), (cleared, ColumnTreatment.Cleared) })
        {
            foreach (var name in names.Split(' ', StringSplitOptions.RemoveEmptyEntries))
                columns.Add(name, treatment);
        }

        return columns;
    }
}
