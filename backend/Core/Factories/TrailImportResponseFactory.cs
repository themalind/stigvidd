// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.TrailImport.Apply;
using Core.TrailImport.Review;
using Core.TrailImport.Source;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using WebDataContracts.ResponseModels.TrailImport;

namespace Core.Factories;

public class TrailImportResponseFactory
{
    public TrailImportSessionResponse Create(TrailImportSession session, ProposalCounts? counts)
    {
        return TrailImportSessionResponse.Create(
            session.Id,
            session.Identifier,
            session.Source,
            session.FileName,
            session.FileHash,
            session.FileSizeBytes,
            session.Status.ToString(),
            session.UploadedBy,
            session.CreatedAt,
            session.AnalyzedAt,
            session.AppliedAt,
            session.FeatureCount,
            session.ErrorMessage,
            counts is null ? null : TrailImportCountsResponse.Create(
                counts.Total,
                counts.Certain,
                counts.High,
                counts.Medium,
                counts.Unmatched,
                counts.Pending,
                counts.Accepted,
                counts.Relinked,
                counts.CreateNew,
                counts.Excluded,
                counts.Skipped),
            session.Status == ImportSessionStatus.Applied
                ? Create(session, ApplyReport.Read(session.ApplyReport))
                : null);
    }

    public TrailImportApplyResponse Create(TrailImportSession session, ApplyReport report)
    {
        return TrailImportApplyResponse.Create(
            session.Id,
            session.Status.ToString(),
            session.AppliedAt,
            report.TrailsCreated,
            report.TrailsUpdated,
            report.LinksWritten,
            report.FeaturesExcluded,
            report.TrailsLinked,
            report.Conflicts.Select(c => TrailImportApplyConflictResponse.Create(
                c.TrailId, c.TrailName, c.Field, c.Ours, c.Theirs)));
    }

    // The feature's own half of the preview. The trail it is matched against is read
    // separately and set by the caller.
    public TrailImportPreviewResponse Create(TrailImportProposal proposal)
    {
        var stated = TrailLength.Parse(ReadSourceLength(proposal.FeatureProperties));
        var measured = TrailLength.FromGeometry(proposal.FeatureGeometry);

        return TrailImportPreviewResponse.Create(
            proposal.Id,
            proposal.FeatureName,
            proposal.Confidence.ToString(),
            proposal.MatchReason,
            proposal.CoverageForward,
            proposal.CoverageBackward,
            proposal.HausdorffMeters,
            GeoPathSerializer.ToCoordinatePairs(proposal.FeatureGeometry!),
            measured,
            stated,
            stated.HasValue && TrailLength.Disagrees(stated.Value, measured),
            proposal.FeatureProperties);
    }

    // keep-comment: read as text, not deserialised — Borås writes sparlangd in six shapes and TrailLength.Parse expects that;
    // keep-comment: Umeå's numeric langd is turned into the same text so the one parser serves both.
    private static string? ReadSourceLength(string? properties)
    {
        if (string.IsNullOrWhiteSpace(properties))
            return null;

        try
        {
            using var document = System.Text.Json.JsonDocument.Parse(properties);

            var root = document.RootElement;

            if (root.TryGetProperty("sparlangd", out var value))
                return value.ToString();

            // keep-comment: Umeå kommun's langd is a bare number of metres, and 0 where it was never measured.
            return root.TryGetProperty("langd", out var metres)
                && metres.ValueKind == System.Text.Json.JsonValueKind.Number
                && metres.TryGetDecimal(out var amount) && amount > 0
                ? $"{amount.ToString(System.Globalization.CultureInfo.InvariantCulture)} m"
                : null;
        }
        catch (System.Text.Json.JsonException)
        {
            return null;
        }
    }
}
