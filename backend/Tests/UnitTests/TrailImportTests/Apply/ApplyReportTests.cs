// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.TrailImport.Apply;
using AwesomeAssertions;

namespace UnitTests.TrailImportTests.Apply;

/// <summary>
/// The apply report is a jsonb column, so every session applied before a field existed
/// still has to read back. A report that cannot be read is not a reason to fail the
/// request that only wanted to look at it.
/// </summary>
public class ApplyReportTests
{
    [Fact]
    public void Read_ForAReportWrittenBeforeTrailsLinkedExisted_ShouldLeaveItUnknown()
    {
        // Arrange — verbatim from the first session applied against the test database
        const string stored =
            """{"Conflicts": [], "LinksWritten": 194, "TrailsCreated": 11, "TrailsUpdated": 0, "FeaturesExcluded": 0}""";

        // Act
        var report = ApplyReport.Read(stored);

        // Assert
        report.TrailsCreated.Should().Be(11);
        report.LinksWritten.Should().Be(194);
        // Not zero: nobody counted them, which is not the same as there being none.
        report.TrailsLinked.Should().BeNull();
    }

    [Fact]
    public void Read_ForACompleteReport_ShouldCarryEveryFigure()
    {
        // Arrange
        var written = new ApplyReport(2, 3, 9, 1, [new ApplyConflict(4, "Dannike", "TrailSymbol", "Blå", "Röd")], 7);

        // Act
        var report = ApplyReport.Read(System.Text.Json.JsonSerializer.Serialize(written));

        // Assert
        report.Should().BeEquivalentTo(written);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("not json at all")]
    [InlineData("{\"TrailsCreated\": \"eleven\"}")]
    public void Read_ForAReportItCannotParse_ShouldComeBackEmptyRatherThanThrow(string? stored)
    {
        // Act
        var report = ApplyReport.Read(stored);

        // Assert
        report.Should().Be(ApplyReport.None);
    }
}
