using Core.TrailImport.Matching;
using Infrastructure.Enums;
using NetTopologySuite.Geometries;

namespace Core.TrailImport.Apply;

// One decided feature with everything the write needs: the geometry and properties the
// source published, and the trail it lands on. Heavier than ApplyPlanRow because it
// carries the geometry, so it is read only when a session is actually being applied.
public record ApplyFeature(
    int ProposalId,
    string ExternalId,
    string FeatureName,
    string GeometryFingerprint,
    string? FeatureProperties,
    LineString? FeatureGeometry,
    ProposalDecision Decision,
    TrailSourceLinkRole Role,
    MatchConfidence Confidence,
    int? TargetTrailId,
    string? DecidedName,
    decimal? DecidedLengthKm);

// A trail as it stands before the apply. The three-way merge compares against these.
public record ApplyTarget(
    int TrailId,
    string Name,
    int Classification,
    bool Accessibility,
    string AccessibilityInfo,
    string TrailSymbol,
    LineString? GeoPath);

// The link already on file for a fingerprint. SourceSnapshot is the merge's baseline;
// without one the source has never been recorded for this feature and nothing it owns
// may be written.
public record ApplyBaseline(int LinkId, int? TrailId, string? SourceSnapshot);

// Everything the apply phase reads before it writes anything.
public record ApplyInput(
    IReadOnlyList<ApplyFeature> Features,
    IReadOnlyDictionary<int, ApplyTarget> Targets,
    IReadOnlyDictionary<string, ApplyBaseline> LinksByFingerprint,

    // Trails that already have a link for this source. On the first sync a trail is
    // absent here, and then no source-owned field is written on it at all.
    IReadOnlySet<int> TrailsWithBaseline);
