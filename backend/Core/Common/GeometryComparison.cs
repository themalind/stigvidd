using NetTopologySuite.Geometries;
using NetTopologySuite.Operation.Distance;

namespace Core.Common;

// Measures how much of one line runs along another, in metres. This is what separates a
// redrawn version of a trail from a different trail that happens to share a trailhead.
public static class GeometryComparison
{
    // Points are taken along each line at this spacing, so the figures do not depend on
    // how densely the source happened to digitise it. The source re-densifies geometry
    // between exports, which is exactly what would skew a vertex count.
    private const double SampleSpacingMetres = 10;

    public readonly record struct Comparison(
        double CoverageForward,     // share of the feature that runs along the trail
        double CoverageBackward,    // share of the trail that runs along the feature
        double HausdorffMetres);    // worst separation found anywhere on either line

    public static Comparison Compare(LineString feature, LineString trail, double toleranceMetres)
    {
        ArgumentNullException.ThrowIfNull(feature);
        ArgumentNullException.ThrowIfNull(trail);

        if (feature.IsEmpty || trail.IsEmpty)
            return new Comparison(0, 0, double.PositiveInfinity);

        var area = feature.EnvelopeInternal.Copy();
        area.ExpandToInclude(trail.EnvelopeInternal);

        var projection = LocalMetricProjection.CentredOn(area);
        var projectedFeature = projection.Project(feature);
        var projectedTrail = projection.Project(trail);

        var forward = Measure(projectedFeature, projectedTrail, toleranceMetres);
        var backward = Measure(projectedTrail, projectedFeature, toleranceMetres);

        return new Comparison(forward.Coverage, backward.Coverage,
            Math.Max(forward.Worst, backward.Worst));
    }

    // Walks samples along one line and asks how far each one is from the other.
    private static (double Coverage, double Worst) Measure(LineString from, LineString to, double toleranceMetres)
    {
        var distance = new IndexedFacetDistance(to);

        var covered = 0;
        var total = 0;
        var worst = 0.0;

        foreach (var sample in Sample(from))
        {
            var metres = distance.Distance(new Point(sample));

            if (metres <= toleranceMetres)
                covered++;

            worst = Math.Max(worst, metres);
            total++;
        }

        return (total == 0 ? 0 : (double)covered / total, worst);
    }

    private static IEnumerable<Coordinate> Sample(LineString line)
    {
        var coordinates = line.Coordinates;

        yield return coordinates[0];

        var carried = 0.0;

        for (var i = 1; i < coordinates.Length; i++)
        {
            var previous = coordinates[i - 1];
            var current = coordinates[i];
            var segment = previous.Distance(current);

            if (segment <= 0)
                continue;

            // Step along the segment, carrying the leftover distance into the next one.
            for (var along = SampleSpacingMetres - carried; along < segment; along += SampleSpacingMetres)
            {
                var fraction = along / segment;

                yield return new Coordinate(
                    previous.X + (current.X - previous.X) * fraction,
                    previous.Y + (current.Y - previous.Y) * fraction);
            }

            carried = (carried + segment) % SampleSpacingMetres;
        }

        yield return coordinates[^1];
    }
}
