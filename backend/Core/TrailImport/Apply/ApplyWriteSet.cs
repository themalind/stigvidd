using Core.TrailImport.Matching;
using Core.TrailImport.Source;
using Infrastructure.Enums;
using NetTopologySuite.Geometries;

namespace Core.TrailImport.Apply;

// A trail the apply creates. It has nothing curated to protect, so it takes every field
// the source offers — except the name and the length, which come from the reviewer.
public record TrailCreate(
    int ProposalId,
    string Name,
    decimal TrailLength,
    LineString Geometry,
    int Classification,
    bool Accessibility,
    string AccessibilityInfo,
    string TrailSymbol);

// What the apply changes on a trail that already exists. Every property is null unless
// the merge decided to write it, so an update that changes nothing writes nothing.
public record TrailUpdate(
    int TrailId,
    decimal? TrailLength,
    int? Classification,
    bool? Accessibility,
    string? AccessibilityInfo,
    string? TrailSymbol,
    LineString? GeoPath)
{
    public bool IsEmpty => TrailLength is null && Classification is null && Accessibility is null
        && AccessibilityInfo is null && TrailSymbol is null && GeoPath is null;
}

// A link to write, new or existing. TrailId is null for an excluded feature; for one
// whose trail this same apply creates it is null too, and CreatedForProposalId names the
// create whose new id fills it in.
public record LinkWrite(
    int? LinkId,
    string GeometryFingerprint,
    string ExternalId,
    int? TrailId,
    int? CreatedForProposalId,
    TrailSourceLinkRole Role,
    MatchConfidence Confidence,
    string? SourceSnapshot,

    // Stops a later sync from re-pointing the link on its own.
    bool ConfirmedByHuman);

// A source-owned field both sides changed. Ours stands; the difference is reported so a
// human can look at it.
public record ApplyConflict(int TrailId, string TrailName, string Field, string Ours, string Theirs);

// Everything one apply will write, worked out before the transaction opens.
public record ApplyWriteSet(
    IReadOnlyList<TrailCreate> Creates,
    IReadOnlyList<TrailUpdate> Updates,
    IReadOnlyList<LinkWrite> Links,
    IReadOnlyList<ApplyConflict> Conflicts);
