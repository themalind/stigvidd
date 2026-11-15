// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Services.Reporting;
using Moq;

namespace UnitTests.ServiceTests;

public class AdminDashboardServiceTests
{
    [Fact]
    public async Task GetAttentionAsync_ReturnsEachCountInItsOwnField()
    {
        // Arrange
        var repo = new Mock<IAdminDashboardRepository>();
        repo.Setup(r => r.GetAttentionCountsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<AdminAttentionCounts>.Success(new AdminAttentionCounts(1, 2, 3, 4)));

        // Act
        var result = await new AdminDashboardService(repo.Object).GetAttentionAsync(TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.PendingHikeSubmissions.Should().Be(1);
        result.Value.PendingReports.Should().Be(2);
        result.Value.FailedMails.Should().Be(3);
        result.Value.ImportsAwaitingReview.Should().Be(4);
    }

    [Fact]
    public async Task GetAttentionAsync_WhenCountingFails_Returns500()
    {
        // Arrange
        var repo = new Mock<IAdminDashboardRepository>();
        repo.Setup(r => r.GetAttentionCountsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<AdminAttentionCounts>.Error());

        // Act
        var result = await new AdminDashboardService(repo.Object).GetAttentionAsync(TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }
}
