namespace WebDataContracts.ResponseModels.TrailImport;

// One row in the review list. Confidence and decision go out as names, not numbers, so
// the enum values stay an implementation detail of the database.
public class TrailImportProposalResponse
{
    public required int Id { get; set; }
    public required string ExternalId { get; set; }
    public required string FeatureName { get; set; }
    public required string Confidence { get; set; }
    public double CoverageForward { get; set; }
    public double CoverageBackward { get; set; }
    public double? HausdorffMeters { get; set; }
    public string? MatchReason { get; set; }
    public required string Decision { get; set; }
    public required string DecidedRole { get; set; }
    public int? SuggestedTrailId { get; set; }
    public string? SuggestedTrailName { get; set; }

    // The trail the coverage was measured against. Shown as information, never as a
    // suggestion, and set also when the feature matched nothing.
    public int? NearestTrailId { get; set; }
    public string? NearestTrailName { get; set; }
    public int? DecidedTrailId { get; set; }
    public string? DecidedTrailName { get; set; }
    public string? DecidedBy { get; set; }
    public DateTime? DecidedAt { get; set; }
    public string? Note { get; set; }

    // What the reviewer overrode: the name a created trail will take, and the length to
    // write. Null in either means the row carries no override.
    public string? DecidedName { get; set; }
    public decimal? DecidedLengthKm { get; set; }
}
