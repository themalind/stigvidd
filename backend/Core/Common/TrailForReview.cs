using NetTopologySuite.Geometries;

namespace Core.Common;

// The trail a proposal points at, as the review view needs to see it: enough to draw it
// beside the feature and to judge whether the curated length still holds.
public sealed record TrailForReview(
    int TrailId,
    string Identifier,
    string Name,
    decimal TrailLength,
    bool IsVerified,
    LineString? GeoPath);
