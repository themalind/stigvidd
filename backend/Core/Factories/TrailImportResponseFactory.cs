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

    // sparlangd out of the stored properties. Read as text rather than deserialised: the
    // source writes the field in six different shapes and TrailLength.Parse expects that.
    private static string? ReadSourceLength(string? properties)
    {
        if (string.IsNullOrWhiteSpace(properties))
            return null;

        try
        {
            using var document = System.Text.Json.JsonDocument.Parse(properties);

            return document.RootElement.TryGetProperty("sparlangd", out var value)
                ? value.ToString()
                : null;
        }
        catch (System.Text.Json.JsonException)
        {
            return null;
        }
    }
}
