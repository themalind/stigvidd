using Core.TrailImport.Apply;
using FluentAssertions;

namespace UnitTests.TrailImportTests.Apply;

public class SourceFieldMergeTests
{
    [Fact]
    public void WithoutABaseline_ShouldWriteNothing()
    {
        // Arrange — the first sync for a trail: no snapshot has ever been stored
        // Act
        var result = SourceFieldMerge.Merge(hasBaseline: false, baseline: "", ours: "ours", theirs: "theirs");

        // Assert — every field looks unedited without a baseline, so nothing may be written
        result.Outcome.Should().Be(MergeOutcome.NoBaseline);
        result.Value.Should().Be("ours");
        result.ShouldWrite.Should().BeFalse();
    }

    [Fact]
    public void WhenTheSourceStoodStill_ShouldKeepOurEdit()
    {
        // Arrange — we rewrote the field; the source says what it said last time
        // Act
        var result = SourceFieldMerge.Merge(hasBaseline: true, baseline: "blue", ours: "red", theirs: "blue");

        // Assert
        result.Outcome.Should().Be(MergeOutcome.KeptOurs);
        result.Value.Should().Be("red");
        result.ShouldWrite.Should().BeFalse();
    }

    [Fact]
    public void WhenWeNeverTouchedIt_ShouldTakeTheSource()
    {
        // Arrange — the trail still holds what the source gave it last time
        // Act
        var result = SourceFieldMerge.Merge(hasBaseline: true, baseline: "blue", ours: "blue", theirs: "green");

        // Assert
        result.Outcome.Should().Be(MergeOutcome.TookSource);
        result.Value.Should().Be("green");
        result.ShouldWrite.Should().BeTrue();
    }

    [Fact]
    public void WhenBothChanged_ShouldKeepOursAndReportAConflict()
    {
        // Arrange — a local edit and a source change since the same baseline
        // Act
        var result = SourceFieldMerge.Merge(hasBaseline: true, baseline: "blue", ours: "red", theirs: "green");

        // Assert — ours stands; the apply report is where the difference surfaces
        result.Outcome.Should().Be(MergeOutcome.Conflict);
        result.Value.Should().Be("red");
        result.ShouldWrite.Should().BeFalse();
    }

    [Fact]
    public void WhenBothChangedToTheSameValue_ShouldNotBeAConflict()
    {
        // Arrange — we and the source independently arrived at the same text
        // Act
        var result = SourceFieldMerge.Merge(hasBaseline: true, baseline: "blue", ours: "green", theirs: "green");

        // Assert
        result.Outcome.Should().Be(MergeOutcome.Unchanged);
        result.ShouldWrite.Should().BeFalse();
    }

    [Fact]
    public void ShouldMergeValueTypesWithoutSpecialCasing()
    {
        // Arrange — Classification is an int, and null is not available to mark "no baseline"
        // Act
        var untouched = SourceFieldMerge.Merge(hasBaseline: true, baseline: 1, ours: 1, theirs: 2);
        var edited = SourceFieldMerge.Merge(hasBaseline: true, baseline: 1, ours: 3, theirs: 2);

        // Assert
        untouched.Outcome.Should().Be(MergeOutcome.TookSource);
        untouched.Value.Should().Be(2);
        edited.Outcome.Should().Be(MergeOutcome.Conflict);
        edited.Value.Should().Be(3);
    }
}
