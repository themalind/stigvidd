using Infrastructure.Enums;
using NetTopologySuite.Geometries;

namespace Infrastructure.Data.Entities;

// One feature from an uploaded file, what the analysis thinks it matches, and what the
// reviewer decided. The apply phase reads these and writes TrailSourceLink and Trail.
public class TrailImportProposal : BaseEntity
{
    public int SessionId { get; set; }
    public TrailImportSession? Session { get; set; }

    // properties.id as it appeared in THIS file. Not stable between exports.
    public required string ExternalId { get; set; }
    public required string FeatureName { get; set; }
    public required string GeometryFingerprint { get; set; }

    public string? FeatureProperties { get; set; }

    // Kept here so the review view never has to read the uploaded file again.
    public LineString? FeatureGeometry { get; set; }

    // Deliberately plain columns, not foreign keys: a proposal is a record of what was
    // decided, and deleting a trail must not rewrite or erase that history.
    public int? SuggestedTrailId { get; set; }

    // What the coverage numbers were measured against, also when nothing matched. Never
    // read as a suggestion: Accept is barred on SuggestedTrailId being null.
    public int? NearestTrailId { get; set; }
    public int? DecidedTrailId { get; set; }
    public int? CreatedTrailId { get; set; }

    public MatchConfidence Confidence { get; set; }
    public double CoverageForward { get; set; }
    public double CoverageBackward { get; set; }
    public double? HausdorffMeters { get; set; }
    public string? MatchReason { get; set; }

    public ProposalDecision Decision { get; set; }
    public TrailSourceLinkRole DecidedRole { get; set; }
    public string? DecidedBy { get; set; }
    public DateTime? DecidedAt { get; set; }
    public string? Note { get; set; }

    // What the reviewer typed over the source. The name is only read when the decision is
    // CreateNew; the length is written to whichever trail the feature ends up on.
    public string? DecidedName { get; set; }
    public decimal? DecidedLengthKm { get; set; }
}
