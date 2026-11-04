// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.Enums;

namespace WebDataContracts.ResponseModels.TrailImport;

// One row in the review list. Confidence and decision go out as names, not numbers, so
// the enum values stay an implementation detail of the database.
public class TrailImportProposalResponse
{
    public required int Id { get; set; }
    public required string ExternalId { get; set; }
    public required string FeatureName { get; set; }
    public required MatchConfidence Confidence { get; set; }
    public required double CoverageForward { get; set; }
    public required double CoverageBackward { get; set; }
    public required double? HausdorffMeters { get; set; }
    public required string? MatchReason { get; set; }
    public required ProposalDecision Decision { get; set; }
    public required TrailSourceLinkRole DecidedRole { get; set; }
    public required int? SuggestedTrailId { get; set; }
    public required string? SuggestedTrailName { get; set; }

    // The trail the coverage was measured against. Shown as information, never as a
    // suggestion, and set also when the feature matched nothing.
    public required int? NearestTrailId { get; set; }
    public required string? NearestTrailName { get; set; }
    public required int? DecidedTrailId { get; set; }
    public required string? DecidedTrailName { get; set; }
    public required string? DecidedBy { get; set; }
    public required DateTime? DecidedAt { get; set; }
    public required string? Note { get; set; }

    // What the reviewer overrode: the name a created trail will take, and the length to
    // write. Null in either means the row carries no override.
    public required string? DecidedName { get; set; }
    public required decimal? DecidedLengthKm { get; set; }

    public static TrailImportProposalResponse Create(
        int id,
        string externalId,
        string featureName,
        MatchConfidence confidence,
        double coverageForward,
        double coverageBackward,
        double? hausdorffMeters,
        string? matchReason,
        ProposalDecision decision,
        TrailSourceLinkRole decidedRole,
        int? suggestedTrailId,
        string? suggestedTrailName,
        int? nearestTrailId,
        string? nearestTrailName,
        int? decidedTrailId,
        string? decidedTrailName,
        string? decidedBy,
        DateTime? decidedAt,
        string? note,
        string? decidedName,
        decimal? decidedLengthKm)
    {
        return new TrailImportProposalResponse
        {
            Id = id,
            ExternalId = externalId,
            FeatureName = featureName,
            Confidence = confidence,
            CoverageForward = coverageForward,
            CoverageBackward = coverageBackward,
            HausdorffMeters = hausdorffMeters,
            MatchReason = matchReason,
            Decision = decision,
            DecidedRole = decidedRole,
            SuggestedTrailId = suggestedTrailId,
            SuggestedTrailName = suggestedTrailName,
            NearestTrailId = nearestTrailId,
            NearestTrailName = nearestTrailName,
            DecidedTrailId = decidedTrailId,
            DecidedTrailName = decidedTrailName,
            DecidedBy = decidedBy,
            DecidedAt = decidedAt,
            Note = note,
            DecidedName = decidedName,
            DecidedLengthKm = decidedLengthKm
        };
    }
}
