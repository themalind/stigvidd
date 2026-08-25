using Infrastructure.Enums;

namespace Core.TrailImport.Review;

// One row in the review list. Deliberately without FeatureGeometry: a page of 50 features
// would otherwise drag tens of thousands of coordinates along for a list that draws none.
public sealed record ProposalSummary(
    int Id,
    string ExternalId,
    string FeatureName,
    MatchConfidence Confidence,
    double CoverageForward,
    double CoverageBackward,
    double? HausdorffMetres,
    string? MatchReason,
    ProposalDecision Decision,
    TrailSourceLinkRole DecidedRole,
    int? SuggestedTrailId,
    string? SuggestedTrailName,
    int? NearestTrailId,
    string? NearestTrailName,
    int? DecidedTrailId,
    string? DecidedTrailName,
    string? DecidedBy,
    DateTime? DecidedAt,
    string? Note,
    string? DecidedName,
    decimal? DecidedLengthKm);

// How a session's features are spread across confidences and decisions. Drives the
// summary row above the review list and answers whether the session is ready to apply.
public sealed record ProposalCounts(
    int Total,
    int Certain,
    int High,
    int Medium,
    int Unmatched,
    int Pending,
    int Accepted,
    int Relinked,
    int CreateNew,
    int Excluded,
    int Skipped);
