// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Interfaces.Repositories;
using Infrastructure.Enums;

namespace UnitTests.FactoryTests;

public class ContentReportResponseFactoryTests
{
    private static ContentReportSummary Summary(ReportedContentType contentType, string? snapshot) => new(
        "report-1", contentType, "content-1", null, ReportReason.Offensive, null, ReportStatus.Pending,
        ReportHideOutcome.Hidden, "Reporter", "Author", "author-1", null, snapshot, true, null, null, null,
        DateTime.UtcNow);

    [Fact]
    public void Create_ForAHikeImage_GivesTheSnapshotAsAnAbsoluteImageUrl()
    {
        // Arrange
        var factory = Utilities.Stubs.ContentReportResponseFactory();

        // Act
        var result = factory.Create(Summary(ReportedContentType.HikeImage, "hikes/a.jpg"));

        // Assert
        result.ContentImageUrl.Should().Be(Utilities.Stubs.PresentableBaseUrl + "hikes/a.jpg");
        result.ContentSnapshot.Should().Be("hikes/a.jpg");
    }

    [Fact]
    public void Create_ForAReview_GivesNoImageUrl()
    {
        // Arrange
        var factory = Utilities.Stubs.ContentReportResponseFactory();

        // Act
        var result = factory.Create(Summary(ReportedContentType.Review, "Some text"));

        // Assert
        result.ContentImageUrl.Should().BeNull();
    }

    [Fact]
    public void Create_ForAHikeImageWhoseSnapshotWasCleared_GivesNoImageUrl()
    {
        // Arrange
        var factory = Utilities.Stubs.ContentReportResponseFactory();

        // Act
        var result = factory.Create(Summary(ReportedContentType.HikeImage, null));

        // Assert
        result.ContentImageUrl.Should().BeNull();
    }
}
