// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.TrailImport.Matching;
using AwesomeAssertions;
using NetTopologySuite.Geometries;
using System.Globalization;

namespace UnitTests.TrailImportTests.Matching;

/// <summary>
/// The fingerprint is the join key between a Borås Stad feature and a trail, because
/// the source's properties.id changes between exports (zero ids in common across the
/// 2025 and 2026 files). It therefore has to be stable for the same shape and distinct
/// for different ones.
/// </summary>
public class GeometryFingerprintTests
{
    private static LineString Line(params (double X, double Y)[] points) =>
        new([.. points.Select(p => new Coordinate(p.X, p.Y))]);

    [Fact]
    public void Compute_ForTheSameGeometry_ShouldReturnTheSameFingerprint()
    {
        // Arrange
        var first = Line((12.8446637, 57.6702168), (12.8497814, 57.6802595), (12.8603287, 57.6844817));
        var second = Line((12.8446637, 57.6702168), (12.8497814, 57.6802595), (12.8603287, 57.6844817));

        // Act & Assert
        GeometryFingerprint.Compute(first).Should().Be(GeometryFingerprint.Compute(second));
    }

    [Fact]
    public void Compute_ForAReversedGeometry_ShouldReturnTheSameFingerprint()
    {
        // Arrange — the same physical trail digitised from the other end.
        var forward = Line((12.8446637, 57.6702168), (12.8497814, 57.6802595), (12.8603287, 57.6844817));
        var backward = Line((12.8603287, 57.6844817), (12.8497814, 57.6802595), (12.8446637, 57.6702168));

        // Act & Assert
        GeometryFingerprint.Compute(forward).Should().Be(GeometryFingerprint.Compute(backward));
    }

    [Fact]
    public void Compute_ForDifferentGeometries_ShouldReturnDifferentFingerprints()
    {
        // Arrange
        var first = Line((12.8446637, 57.6702168), (12.8603287, 57.6844817));
        var second = Line((12.8446637, 57.6702168), (12.8703287, 57.6944817));

        // Act & Assert
        GeometryFingerprint.Compute(first).Should().NotBe(GeometryFingerprint.Compute(second));
    }

    [Fact]
    public void Compute_ForSameEndpointsButADifferentRoute_ShouldReturnDifferentFingerprints()
    {
        // Arrange — two trails sharing a trailhead is common in the source, so endpoints
        // alone are not enough to tell them apart.
        var first = Line((12.8446637, 57.6702168), (12.8500000, 57.6750000), (12.8603287, 57.6844817));
        var second = Line((12.8446637, 57.6702168), (12.8520000, 57.6790000), (12.8603287, 57.6844817));

        // Act & Assert
        GeometryFingerprint.Compute(first).Should().NotBe(GeometryFingerprint.Compute(second));
    }

    [Fact]
    public void Compute_ForADifferentPointCountAlongTheSameLine_ShouldReturnDifferentFingerprints()
    {
        // Arrange — the source re-densifies geometry between exports; that is a real change.
        var sparse = Line((12.8446637, 57.6702168), (12.8603287, 57.6844817));
        var dense = Line((12.8446637, 57.6702168), (12.8524962, 57.6773493), (12.8603287, 57.6844817));

        // Act & Assert
        GeometryFingerprint.Compute(sparse).Should().NotBe(GeometryFingerprint.Compute(dense));
    }

    [Fact]
    public void Compute_ForNoiseBelowTheStoredPrecision_ShouldReturnTheSameFingerprint()
    {
        // Arrange — differences in the ninth decimal are below a centimetre.
        var first = Line((12.84466370, 57.67021680), (12.86032870, 57.68448170));
        var second = Line((12.844663701, 57.670216801), (12.860328702, 57.684481703));

        // Act & Assert
        GeometryFingerprint.Compute(first).Should().Be(GeometryFingerprint.Compute(second));
    }

    [Fact]
    public void Compute_ForADifferenceAtTheStoredPrecision_ShouldReturnDifferentFingerprints()
    {
        // Arrange
        var first = Line((12.8446637, 57.6702168), (12.8603287, 57.6844817));
        var second = Line((12.8446638, 57.6702168), (12.8603287, 57.6844817));

        // Act & Assert
        GeometryFingerprint.Compute(first).Should().NotBe(GeometryFingerprint.Compute(second));
    }

    [Fact]
    public void Compute_ShouldIgnoreTheZOrdinate()
    {
        // Arrange — the export ships every coordinate as [lon, lat, 0].
        var flat = Line((12.8446637, 57.6702168), (12.8603287, 57.6844817));
        var withElevation = new LineString([
            new CoordinateZ(12.8446637, 57.6702168, 0),
            new CoordinateZ(12.8603287, 57.6844817, 143.5)]);

        // Act & Assert
        GeometryFingerprint.Compute(withElevation).Should().Be(GeometryFingerprint.Compute(flat));
    }

    [Fact]
    public void Compute_UnderASwedishCulture_ShouldReturnTheSameFingerprint()
    {
        // Arrange — sv-SE writes decimals with a comma, which would silently change the hash.
        var line = Line((12.8446637, 57.6702168), (12.8603287, 57.6844817));
        var invariant = GeometryFingerprint.Compute(line);

        var original = CultureInfo.CurrentCulture;
        CultureInfo.CurrentCulture = new CultureInfo("sv-SE");

        try
        {
            // Act & Assert
            GeometryFingerprint.Compute(line).Should().Be(invariant);
        }
        finally
        {
            CultureInfo.CurrentCulture = original;
        }
    }

    [Fact]
    public void Compute_ForALineThatRetracesItself_ShouldNotThrow()
    {
        // Arrange — an out-and-back is identical read from either end.
        var line = Line((12.8446637, 57.6702168), (12.8603287, 57.6844817), (12.8446637, 57.6702168));

        // Act
        var act = () => GeometryFingerprint.Compute(line);

        // Assert
        act.Should().NotThrow();
    }

    [Fact]
    public void Compute_ForNull_ShouldThrow()
    {
        // Act
        var act = () => GeometryFingerprint.Compute(null);

        // Assert
        act.Should().Throw<ArgumentNullException>();
    }

    [Fact]
    public void Compute_ForAnEmptyGeometry_ShouldThrow()
    {
        // Arrange — every empty line would otherwise share one fingerprint and match itself.
        var empty = new LineString([]);

        // Act
        var act = () => GeometryFingerprint.Compute(empty);

        // Assert
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Compute_ShouldReturnASha256HexDigest()
    {
        // Arrange
        var line = Line((12.8446637, 57.6702168), (12.8603287, 57.6844817));

        // Act
        var fingerprint = GeometryFingerprint.Compute(line);

        // Assert
        fingerprint.Should().HaveLength(64).And.MatchRegex("^[0-9a-f]{64}$");
    }

    // Fingerprints are stored in TrailSourceLink and matched against on every later
    // import. Change the algorithm and every stored fingerprint becomes a value nothing
    // will match again, so the next sync sees a wholly unfamiliar dataset and proposes
    // creating all 203 trails afresh. These three digests pin the format against exactly
    // that: a refactor that alters them fails here rather than in production.

    [Fact]
    public void Compute_ForAKnownBorasLine_ShouldKeepProducingTheSameDigest()
    {
        // Arrange — the first three points of feature 380, Kanotcentralen - Bovik.
        var line = Line(
            (12.8446637318, 57.6702168075),
            (12.8497813698, 57.6802594675),
            (12.8603286874, 57.6844817187));

        // Act & Assert
        GeometryFingerprint.Compute(line).Should()
            .Be("e713360116202373eb70feb4cdc249a1442f4b59a742ebddbf8031b79d8b09d1");
    }

    [Fact]
    public void Compute_ForOneDegreeOfLatitude_ShouldKeepProducingTheSameDigest()
    {
        // Arrange — whole numbers, where trailing-zero formatting would show up.
        var line = Line((0, 0), (0, 1));

        // Act & Assert
        GeometryFingerprint.Compute(line).Should()
            .Be("88688347cb319a8f808f18b04ae01d2b9a62cf417be1227179ae5ac7a6b62a45");
    }

    [Fact]
    public void Compute_ForNegativeCoordinates_ShouldKeepProducingTheSameDigest()
    {
        // Arrange — negative values, where a sign or a minus-zero would show up.
        var line = Line((-1.5, -2.25), (3.125, 4.0625));

        // Act & Assert
        GeometryFingerprint.Compute(line).Should()
            .Be("63760b95b61e068bde5d74e45476a967ba3118d75760bbe1ba5160b94ed8a3c9");
    }
}
