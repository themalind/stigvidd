using FluentAssertions;
using NetTopologySuite.Geometries;
using System.Globalization;

namespace UnitTests.CommonTests;

/// <summary>
/// The Borås Stad source writes sparlangd six different ways. Parse only trusts the two
/// that name their unit; everything else falls through to the geometry. Every string in
/// these tests is taken verbatim from the 2026-08 export.
/// </summary>
public class TrailLengthTests
{
    private static LineString Line(params (double X, double Y)[] points) =>
        new([.. points.Select(p => new Coordinate(p.X, p.Y))]);

    [Theory]
    [InlineData("2,5 km", 2.5)]
    [InlineData("31,5 km", 31.5)]
    [InlineData("10 km", 10)]
    [InlineData("140 km", 140)]
    [InlineData("3,5 km ", 3.5)]          // trailing space
    [InlineData("Drygt 1 km", 1)]         // prose in front of the number
    public void Parse_ForKilometres_ShouldReadTheNumber(string source, double expected)
    {
        // Act & Assert
        TrailLength.Parse(source).Should().Be((decimal)expected);
    }

    [Theory]
    [InlineData("800 m", 0.8)]
    [InlineData("400 m", 0.4)]
    [InlineData("9100m", 9.1)]            // no space before the unit
    public void Parse_ForMetres_ShouldConvertToKilometres(string source, double expected)
    {
        // Act & Assert
        TrailLength.Parse(source).Should().Be((decimal)expected);
    }

    [Theory]
    [InlineData("5 min")]
    [InlineData("30 min")]
    [InlineData("60 min")]
    public void Parse_ForATime_ShouldReturnNull(string source)
    {
        // Act & Assert — "5 min" sits on trails measuring both 0,29 and 0,41 km, so there
        // is no speed to convert with.
        TrailLength.Parse(source).Should().BeNull();
    }

    [Fact]
    public void Parse_ForARange_ShouldReturnNull()
    {
        // Act & Assert — the five features carrying this string measure 0,48 to 5,73 km.
        // It ends in "km", so it has to be rejected before the unit is considered.
        TrailLength.Parse("2,4 - 5,3 km").Should().BeNull();
    }

    [Theory]
    [InlineData("1724")]                  // metres, on a 1,71 km trail
    [InlineData("874")]
    [InlineData("2,5")]                   // kilometres, on a 2,80 km trail
    [InlineData("6,8")]
    public void Parse_ForABareNumber_ShouldReturnNull(string source)
    {
        // Act & Assert — "1724" and "2,5" cannot be told apart without guessing at the
        // decimal separator, and guessing wrong costs 1724 km. The geometry decides.
        TrailLength.Parse(source).Should().BeNull();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("okänd")]
    public void Parse_ForNothingUsable_ShouldReturnNull(string? source)
    {
        // Act & Assert
        TrailLength.Parse(source).Should().BeNull();
    }

    [Fact]
    public void Parse_UnderASwedishCulture_ShouldReadTheSameNumber()
    {
        // Arrange — the source writes decimals with a comma, and so does sv-SE.
        var original = CultureInfo.CurrentCulture;
        CultureInfo.CurrentCulture = new CultureInfo("sv-SE");

        try
        {
            // Act & Assert
            TrailLength.Parse("31,5 km").Should().Be(31.5m);
        }
        finally
        {
            CultureInfo.CurrentCulture = original;
        }
    }

    [Fact]
    public void FromGeometry_ForOneDegreeOfLatitude_ShouldBeAboutOneHundredAndElevenKilometres()
    {
        // Arrange
        var line = Line((0, 0), (0, 1));

        // Act
        var length = TrailLength.FromGeometry(line);

        // Assert — π × 6371,0088 / 180.
        length.Should().BeApproximately(111.19m, 0.01m);
    }

    [Fact]
    public void FromGeometry_ShouldSumEverySegment()
    {
        // Arrange
        var single = Line((0, 0), (0, 1));
        var doubled = Line((0, 0), (0, 1), (0, 2));

        // Act & Assert
        TrailLength.FromGeometry(doubled).Should().BeApproximately(
            TrailLength.FromGeometry(single) * 2, 0.01m);
    }

    [Fact]
    public void FromGeometry_ForATwoPointLineInBoras_ShouldMatchTheMeasuredDistance()
    {
        // Arrange — the first two points of feature 380, Kanotcentralen - Bovik.
        var line = Line((12.8446637318, 57.6702168075), (12.8497813698, 57.6802594675));

        // Act & Assert
        TrailLength.FromGeometry(line).Should().BeApproximately(1.15m, 0.02m);
    }

    [Fact]
    public void FromGeometry_ForNull_ShouldThrow()
    {
        // Act
        var act = () => TrailLength.FromGeometry(null);

        // Assert
        act.Should().Throw<ArgumentNullException>();
    }

    [Theory]
    [InlineData(8.2, 15.72)]              // Banvallen — source says half the measured line
    [InlineData(2.0, 0.06)]               // Kröcklings hage — a fragment, not a trail
    [InlineData(22, 12.46)]               // Sjuhäradsleden Etapp 10 — wrong in the source
    public void Disagrees_WhenTheFiguresAreFarApart_ShouldBeTrue(double parsed, double measured)
    {
        // Act & Assert
        TrailLength.Disagrees((decimal)parsed, (decimal)measured).Should().BeTrue();
    }

    [Theory]
    [InlineData(13, 13.03)]               // Etapp 01 — the source is right
    [InlineData(19, 18.80)]
    [InlineData(2.5, 2.29)]
    [InlineData(140, 134.25)]             // Alla Etapper — 4 % out, still fine
    public void Disagrees_WhenTheFiguresAgree_ShouldBeFalse(double parsed, double measured)
    {
        // Act & Assert
        TrailLength.Disagrees((decimal)parsed, (decimal)measured).Should().BeFalse();
    }

    [Fact]
    public void Disagrees_ForAZeroLength_ShouldBeTrue()
    {
        // Act & Assert — nothing to compare, so it needs looking at.
        TrailLength.Disagrees(0, 5).Should().BeTrue();
        TrailLength.Disagrees(5, 0).Should().BeTrue();
    }
}
