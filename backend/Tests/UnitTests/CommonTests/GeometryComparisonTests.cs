using FluentAssertions;
using NetTopologySuite.Geometries;

namespace UnitTests.CommonTests;

/// <summary>
/// Coverage is what separates a redrawn version of a trail from a different trail that
/// happens to share a trailhead. It is measured on points taken at a fixed spacing, so
/// the source re-densifying its geometry between exports cannot move the figures.
/// </summary>
public class GeometryComparisonTests
{
    private const double Tolerance = 15;

    // A degree of latitude is about 111 372 m at these latitudes.
    private static double Metres(double metres) => metres / 111372.0;

    private static LineString Line(params (double X, double Y)[] points) =>
        new([.. points.Select(p => new Coordinate(p.X, p.Y))]);

    private static LineString Straight(double startY, double endY, double x = 12.85, int points = 2)
    {
        var step = (endY - startY) / (points - 1);
        return new LineString([.. Enumerable.Range(0, points).Select(i => new Coordinate(x, startY + i * step))]);
    }

    [Fact]
    public void Compare_ForTheSameLine_ShouldReportFullCoverageAndNoSeparation()
    {
        // Arrange
        var line = Straight(57.670, 57.690);

        // Act
        var result = GeometryComparison.Compare(line, line, Tolerance);

        // Assert
        result.CoverageForward.Should().Be(1);
        result.CoverageBackward.Should().Be(1);
        result.HausdorffMetres.Should().BeApproximately(0, 0.001);
    }

    [Fact]
    public void Compare_ForALineNudgedWithinTheTolerance_ShouldStillReportFullCoverage()
    {
        // Arrange — 5 m apart, which is inside the 15 m the matcher allows.
        var trail = Straight(57.670, 57.690, 12.85);
        var feature = Straight(57.670, 57.690, 12.85 + Metres(5) / Math.Cos(57.68 * Math.PI / 180));

        // Act
        var result = GeometryComparison.Compare(feature, trail, Tolerance);

        // Assert
        result.CoverageForward.Should().Be(1);
        result.CoverageBackward.Should().Be(1);
        result.HausdorffMetres.Should().BeApproximately(5, 1);
    }

    [Fact]
    public void Compare_ForALineBeyondTheTolerance_ShouldReportNoCoverage()
    {
        // Arrange — 40 m apart: a parallel trail, not the same one redrawn.
        var trail = Straight(57.670, 57.690, 12.85);
        var feature = Straight(57.670, 57.690, 12.85 + Metres(40) / Math.Cos(57.68 * Math.PI / 180));

        // Act
        var result = GeometryComparison.Compare(feature, trail, Tolerance);

        // Assert
        result.CoverageForward.Should().Be(0);
        result.CoverageBackward.Should().Be(0);
        result.HausdorffMetres.Should().BeApproximately(40, 2);
    }

    [Fact]
    public void Compare_ForAFeatureThatIsHalfOfTheTrail_ShouldBeFullForwardAndHalfBackward()
    {
        // Arrange — this is a stage being split out of a longer trail, the case that has
        // to reach the review queue rather than be filed as a brand new trail.
        var trail = Straight(57.670, 57.690);
        var feature = Straight(57.670, 57.680);

        // Act
        var result = GeometryComparison.Compare(feature, trail, Tolerance);

        // Assert
        result.CoverageForward.Should().Be(1);
        result.CoverageBackward.Should().BeApproximately(0.5, 0.02);
    }

    [Fact]
    public void Compare_ForTheSameRouteAtADifferentVertexDensity_ShouldReportFullCoverage()
    {
        // Arrange — the source re-densifies its geometry between exports. A vertex count
        // would drop here; sampling at a fixed spacing must not.
        var sparse = Straight(57.670, 57.690, points: 2);
        var dense = Straight(57.670, 57.690, points: 400);

        // Act
        var result = GeometryComparison.Compare(dense, sparse, Tolerance);

        // Assert
        result.CoverageForward.Should().Be(1);
        result.CoverageBackward.Should().Be(1);
    }

    [Fact]
    public void Compare_ForTwoLinesSharingOnlyATrailhead_ShouldReportAlmostNoCoverage()
    {
        // Arrange — two trails leaving the same car park in different directions.
        var trail = Line((12.85, 57.670), (12.85, 57.690));
        var feature = Line((12.85, 57.670), (12.88, 57.670));

        // Act
        var result = GeometryComparison.Compare(feature, trail, Tolerance);

        // Assert
        result.CoverageForward.Should().BeLessThan(0.05);
        result.CoverageBackward.Should().BeLessThan(0.05);
    }

    [Fact]
    public void Compare_ShouldNotDependOnWhichLineIsPassedFirst()
    {
        // Arrange
        var trail = Straight(57.670, 57.690);
        var feature = Straight(57.670, 57.680);

        // Act
        var forward = GeometryComparison.Compare(feature, trail, Tolerance);
        var reversed = GeometryComparison.Compare(trail, feature, Tolerance);

        // Assert
        reversed.CoverageForward.Should().BeApproximately(forward.CoverageBackward, 0.001);
        reversed.CoverageBackward.Should().BeApproximately(forward.CoverageForward, 0.001);
        reversed.HausdorffMetres.Should().BeApproximately(forward.HausdorffMetres, 0.001);
    }

    [Fact]
    public void Compare_ForAnEmptyGeometry_ShouldReportNoCoverage()
    {
        // Arrange
        var trail = Straight(57.670, 57.690);

        // Act
        var result = GeometryComparison.Compare(new LineString([]), trail, Tolerance);

        // Assert
        result.CoverageForward.Should().Be(0);
        result.HausdorffMetres.Should().Be(double.PositiveInfinity);
    }
}
