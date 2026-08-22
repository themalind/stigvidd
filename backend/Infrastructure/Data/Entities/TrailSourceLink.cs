using Infrastructure.Enums;

namespace Infrastructure.Data.Entities;

// Ties one feature in an external dataset to a trail. The join key is the geometry
// fingerprint rather than the source's own id, which is not stable between exports.
public class TrailSourceLink : BaseEntity
{
    public required string Source { get; set; }

    public required string GeometryFingerprint { get; set; }

    // Last observed properties.id. Kept for troubleshooting, never used to match.
    public string? LastSeenExternalId { get; set; }

    // Null while the link sits in the review queue with no trail picked yet.
    public int? TrailId { get; set; }
    public Trail? Trail { get; set; }

    public TrailSourceLinkRole Role { get; set; }
    public MatchConfidence Confidence { get; set; }

    // Stops the sync from re-pointing the link at another trail on its own.
    public bool ConfirmedByHuman { get; set; }

    // The source's properties as of the last import.
    public string? SourceSnapshot { get; set; }

    // Bumped only when the feature turns up in an import, unlike LastUpdatedAt.
    public DateTime LastSeenAt { get; set; }

    public DateTime? MissingSinceAt { get; set; }
    public int MissingImportCount { get; set; }
}
