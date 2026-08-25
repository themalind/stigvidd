namespace WebDataContracts.ResponseModels.TrailImport;

// Everything needed to draw one proposal and judge it: both lines as coordinate pairs,
// the lengths measured off those lines, and what the source claims the length is.
public class TrailImportPreviewResponse
{
    public required int ProposalId { get; set; }
    public required string FeatureName { get; set; }
    public required string Confidence { get; set; }
    public string? MatchReason { get; set; }
    public double CoverageForward { get; set; }
    public double CoverageBackward { get; set; }
    public double? HausdorffMeters { get; set; }

    // [longitude, latitude] pairs, the order GeoJSON uses.
    public required IReadOnlyList<double[]> FeatureCoordinates { get; set; }
    public decimal FeatureLengthKm { get; set; }

    // What the source writes in sparlangd, when it states a unit at all.
    public decimal? SourceStatedLengthKm { get; set; }
    public bool SourceLengthDisagrees { get; set; }

    public IReadOnlyList<double[]>? TrailCoordinates { get; set; }
    public int? TrailId { get; set; }
    public string? TrailIdentifier { get; set; }
    public string? TrailName { get; set; }
    public decimal? TrailCuratedLengthKm { get; set; }
    public decimal? TrailMeasuredLengthKm { get; set; }
    public bool? TrailIsVerified { get; set; }

    // True when the trail above is only the nearest one, not a match the reviewer may
    // accept. The view has to say so, or the drawing reads as a suggestion.
    public bool TrailIsNearestOnly { get; set; }

    // The feature's own properties as they stood in the file, so the reviewer can see
    // what the sync read without opening the export.
    public string? FeatureProperties { get; set; }

    // Other features in this session aiming at the same trail. Empty for all but a handful:
    // the source repeats a trail now and then, and only one copy may carry its geometry.
    public IReadOnlyList<TrailImportSiblingResponse> SharingTheTrail { get; set; } = [];

    public static TrailImportPreviewResponse Create(
        int proposalId,
        string featureName,
        string confidence,
        string? matchReason,
        double coverageForward,
        double coverageBackward,
        double? hausdorffMeters,
        IReadOnlyList<double[]> featureCoordinates,
        decimal featureLengthKm,
        decimal? sourceStatedLengthKm,
        bool sourceLengthDisagrees,
        string? featureProperties)
    {
        return new TrailImportPreviewResponse
        {
            ProposalId = proposalId,
            FeatureName = featureName,
            Confidence = confidence,
            MatchReason = matchReason,
            CoverageForward = coverageForward,
            CoverageBackward = coverageBackward,
            HausdorffMeters = hausdorffMeters,
            FeatureCoordinates = featureCoordinates,
            FeatureLengthKm = featureLengthKm,
            SourceStatedLengthKm = sourceStatedLengthKm,
            SourceLengthDisagrees = sourceLengthDisagrees,
            FeatureProperties = featureProperties
        };
    }
}
