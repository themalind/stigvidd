using Core.TrailImport.Source;
using FluentAssertions;
using Infrastructure.Enums;

namespace UnitTests.TrailImportTests.Source;

/// <summary>
/// Reading the fields the source owns out of a feature's properties. The parsing is the
/// same one TransmogrifyBorasData did inline; it matters more here, because a value read
/// wrong is a value the three-way merge then compares against the wrong baseline.
/// </summary>
public class SourceTrailFieldsTests
{
    [Theory]
    [InlineData("Lätt", (int)Classification.Easy)]
    [InlineData("lätt", (int)Classification.Easy)]
    [InlineData("Medel", (int)Classification.Medium)]
    [InlineData("Svår", (int)Classification.Hard)]
    [InlineData(" SVÅR ", (int)Classification.Hard)]
    [InlineData("okänd", (int)Classification.NotClassified)]
    public void Read_ShouldMapTheSourcesClassificationRegardlessOfCasingAndPadding(
        string klassning, int expected)
    {
        // Arrange
        var properties = $$"""{"klassning":"{{klassning}}"}""";

        // Act
        var fields = SourceTrailFields.Read(properties);

        // Assert
        fields.Classification.Should().Be(expected);
    }

    [Theory]
    [InlineData("JA", true)]
    [InlineData("ja", true)]
    [InlineData("NEJ", false)]
    [InlineData("", false)]
    public void Read_ShouldTreatOnlyAnExplicitJaAsAccessible(string tillganglighet, bool expected)
    {
        // Arrange
        var properties = $$"""{"tillganglighet":"{{tillganglighet}}"}""";

        // Act
        var fields = SourceTrailFields.Read(properties);

        // Assert
        fields.Accessibility.Should().Be(expected);
    }

    [Fact]
    public void Read_ShouldTakeTheTextFieldsAsTheyStand()
    {
        // Arrange
        var properties =
            """{"tillg_text":"Delvis väldigt svår terräng","sparmarkering":"Röd markering"}""";

        // Act
        var fields = SourceTrailFields.Read(properties);

        // Assert
        fields.AccessibilityInfo.Should().Be("Delvis väldigt svår terräng");
        fields.TrailSymbol.Should().Be("Röd markering");
    }

    [Fact]
    public void Read_WhenTheSourceWritesNull_ShouldReadItAsTheDefaultRatherThanThrow()
    {
        // Arrange — klassning and tillg_text are null more often than they are set.
        var properties = """{"klassning":null,"tillg_text":null,"sparmarkering":"Omarkerad"}""";

        // Act
        var fields = SourceTrailFields.Read(properties);

        // Assert
        fields.Classification.Should().Be((int)Classification.NotClassified);
        fields.AccessibilityInfo.Should().BeEmpty();
        fields.TrailSymbol.Should().Be("Omarkerad");
    }

    [Fact]
    public void Read_WhenTheSourceStopsSendingAField_ShouldStillCompareAgainstABaseline()
    {
        // Arrange — a missing key has to read as the same value an empty one does, or the
        // merge sees a change the source never made.
        var missing = SourceTrailFields.Read("""{"sparmarkering":"Blå"}""");
        var empty = SourceTrailFields.Read("""{"sparmarkering":"Blå","tillg_text":""}""");

        // Assert
        missing.Should().Be(empty);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("not json at all")]
    [InlineData("[1,2,3]")]
    public void Read_ForPropertiesItCannotRead_ShouldContributeNothing(string? properties)
    {
        // Act
        var fields = SourceTrailFields.Read(properties);

        // Assert
        fields.Should().Be(SourceTrailFields.None);
    }
}
