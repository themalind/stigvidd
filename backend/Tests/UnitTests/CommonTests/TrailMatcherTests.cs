using FluentAssertions;
using Infrastructure.Enums;
using NetTopologySuite.Geometries;

namespace UnitTests.CommonTests;

/// <summary>
/// Confidence decides whether a feature updates a trail on its own or waits for a human,
/// so the tier boundaries are the safety line of the whole sync. Figures verified against
/// the 2026-08 export and the test database: 177 Certain, 5 High, 5 Medium, 16 Unmatched.
/// </summary>
public class TrailMatcherTests
{
    private static LineString Straight(double startY, double endY, double x = 12.85, int points = 2)
    {
        var step = (endY - startY) / (points - 1);
        return new LineString([.. Enumerable.Range(0, points).Select(i => new Coordinate(x, startY + i * step))]);
    }

    private static TrailCandidate Candidate(int id, LineString geometry) =>
        new(id, GeometryFingerprint.Compute(geometry), geometry);

    private static double Metres(double metres) => metres / 111372.0;

    private static double EastMetres(double metres) => Metres(metres) / Math.Cos(57.68 * Math.PI / 180);

    [Fact]
    public void Match_ForAnIdenticalGeometry_ShouldBeCertain()
    {
        // Arrange
        var geometry = Straight(57.670, 57.690);
        var candidates = new[] { Candidate(42, geometry) };

        // Act
        var match = TrailMatcher.Match(Straight(57.670, 57.690), candidates);

        // Assert
        match.Confidence.Should().Be(MatchConfidence.Certain);
        match.TrailId.Should().Be(42);
        match.NearestTrailId.Should().Be(42);
        match.Reason.Should().Be("identical geometry hash");
    }

    [Fact]
    public void Match_ForAReversedGeometry_ShouldStillBeCertain()
    {
        // Arrange — the fingerprint is direction-normalised, so a redigitised trail does
        // not have to go through the expensive comparison at all.
        var candidates = new[] { Candidate(42, Straight(57.670, 57.690)) };

        // Act
        var match = TrailMatcher.Match(Straight(57.690, 57.670), candidates);

        // Assert
        match.Confidence.Should().Be(MatchConfidence.Certain);
        match.TrailId.Should().Be(42);
    }

    [Fact]
    public void Match_ForATrailRedrawnWithinTheTolerance_ShouldBeHigh()
    {
        // Arrange — 5 m off the stored line along its whole length. This is what the five
        // High matches in the real export look like: same trail, redrawn.
        var trail = Straight(57.670, 57.690, 12.85, points: 50);
        var feature = Straight(57.670, 57.690, 12.85 + EastMetres(5), points: 50);

        // Act
        var match = TrailMatcher.Match(feature, [Candidate(42, trail)]);

        // Assert
        match.Confidence.Should().Be(MatchConfidence.High);
        match.TrailId.Should().Be(42);
        match.CoverageForward.Should().Be(1);
    }

    [Fact]
    public void Match_WhenTheNameWouldDiffer_ShouldStillBeHigh()
    {
        // Arrange — 150 of the 177 geometry-matched trails carry a different name in the
        // source, because ours are edited by hand. The matcher must not look at names;
        // it is not given any.
        var trail = Straight(57.670, 57.690, 12.85, points: 50);
        var feature = Straight(57.670, 57.690, 12.85 + EastMetres(4), points: 50);

        // Act
        var match = TrailMatcher.Match(feature, [Candidate(42, trail)]);

        // Assert
        match.Confidence.Should().Be(MatchConfidence.High);
    }

    [Fact]
    public void Match_ForAFeatureCoveringMostButNotAllOfTheTrail_ShouldBeMedium()
    {
        // Arrange — 85 % of the trail, so it goes to the review queue rather than
        // overwriting the geometry on its own.
        var trail = Straight(57.670, 57.690, points: 100);
        var feature = Straight(57.670, 57.687, points: 100);

        // Act
        var match = TrailMatcher.Match(feature, [Candidate(42, trail)]);

        // Assert
        match.Confidence.Should().Be(MatchConfidence.Medium);
        match.TrailId.Should().Be(42);
    }

    [Fact]
    public void Match_ForAStageOfALongerTrail_ShouldBeMediumAndNameTheTrail()
    {
        // Arrange — the whole feature lies on the trail but covers a fifth of it. This is
        // Sjuhäradsleden's stages being split out of the long route, and it must reach the
        // reviewer pointing at the trail it came from, not be filed as a new trail.
        var trail = Straight(57.670, 57.770, points: 500);
        var feature = Straight(57.670, 57.690, points: 100);

        // Act
        var match = TrailMatcher.Match(feature, [Candidate(42, trail)]);

        // Assert
        match.Confidence.Should().Be(MatchConfidence.Medium);
        match.TrailId.Should().Be(42);
        match.CoverageForward.Should().Be(1);
        match.CoverageBackward.Should().BeLessThan(0.3);
        match.Reason.Should().Contain("of the feature lies on the trail");
    }

    [Fact]
    public void Match_ForAParallelTrailFortyMetresAway_ShouldBeUnmatched()
    {
        // Arrange
        var trail = Straight(57.670, 57.690, 12.85, points: 50);
        var feature = Straight(57.670, 57.690, 12.85 + EastMetres(40), points: 50);

        // Act
        var match = TrailMatcher.Match(feature, [Candidate(42, trail)]);

        // Assert — unmatched, but the numbers were measured against trail 42 and the
        // review list has to be able to say so.
        match.Confidence.Should().Be(MatchConfidence.Unmatched);
        match.TrailId.Should().BeNull();
        match.NearestTrailId.Should().Be(42);
    }

    [Fact]
    public void Match_WhenNothingIsNearby_ShouldBeUnmatchedWithoutComparing()
    {
        // Arrange — the nine new canoe routes in the export look like this.
        var trail = Straight(57.670, 57.690);
        var feature = Straight(58.670, 58.690, 13.85);

        // Act
        var match = TrailMatcher.Match(feature, [Candidate(42, trail)]);

        // Assert
        match.Confidence.Should().Be(MatchConfidence.Unmatched);
        match.TrailId.Should().BeNull();
        match.Reason.Should().Be("no trail nearby");
        match.HausdorffMetres.Should().BeNull();
        match.NearestTrailId.Should().BeNull();
    }

    [Fact]
    public void Match_WithNoCandidatesAtAll_ShouldBeUnmatched()
    {
        // Act — the first sync against an empty database.
        var match = TrailMatcher.Match(Straight(57.670, 57.690), []);

        // Assert
        match.Confidence.Should().Be(MatchConfidence.Unmatched);
        match.TrailId.Should().BeNull();
        match.NearestTrailId.Should().BeNull();
    }

    [Fact]
    public void Match_ShouldPreferTheTrailTheFeatureActuallyRunsAlong()
    {
        // Arrange — a long trail the feature is part of, and a short unrelated one that
        // merely starts nearby. Mutual coverage favours neither, so forward coverage has
        // to break the tie.
        var containing = Candidate(1, Straight(57.670, 57.770, points: 500));
        var neighbour = Candidate(2, Straight(57.670, 57.672, 12.85 + EastMetres(60), points: 20));

        // Act
        var match = TrailMatcher.Match(Straight(57.670, 57.690, points: 100), [neighbour, containing]);

        // Assert
        match.TrailId.Should().Be(1);
        match.NearestTrailId.Should().Be(1);
    }

    [Fact]
    public void Match_ShouldCarryOutTheFingerprintItMatchedOn()
    {
        // Arrange — the proposal stores this value, so it has to be the one the matching
        // compared with rather than a second hash of the same line.
        var feature = Straight(57.670, 57.690, points: 30);

        // Act
        var match = TrailMatcher.Match(feature, [Candidate(42, Straight(57.600, 57.610))]);

        // Assert
        match.FeatureFingerprint.Should().Be(GeometryFingerprint.Compute(feature));
    }
}
