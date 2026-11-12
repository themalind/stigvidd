// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Interfaces.Repositories;
using Microsoft.Extensions.Logging;
using Moq;

namespace UnitTests.ServiceTests;

public class CityAreaMembershipServiceTests
{
    private readonly Mock<ICityAreaRepository> _repository = new();
    private readonly RecordingLogger<CityAreaMembershipService> _logger = new();

    private CityAreaMembershipService Build()
    {
        return new CityAreaMembershipService(_repository.Object, _logger);
    }

    [Fact]
    public async Task TrailsMovedAsync_RecalculatesTheTrails()
    {
        _repository.Setup(r => r.RecalculateTrailsAsync(It.IsAny<IReadOnlyCollection<int>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        await Build().TrailsMovedAsync([3, 4], TestContext.Current.CancellationToken);

        _repository.Verify(r => r.RecalculateTrailsAsync(
            It.Is<IReadOnlyCollection<int>>(ids => ids.SequenceEqual(new[] { 3, 4 })), It.IsAny<CancellationToken>()), Times.Once);
        _logger.Entries.Should().BeEmpty();
    }

    [Fact]
    public async Task FacilitiesMovedAsync_WhenTheRecalculationFails_LogsAWarningInsteadOfThrowing()
    {
        _repository.Setup(r => r.RecalculateFacilitiesAsync(It.IsAny<IReadOnlyCollection<int>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Error());

        await Build().FacilitiesMovedAsync([7], TestContext.Current.CancellationToken);

        _logger.Entries.Should().ContainSingle().Which.Level.Should().Be(LogLevel.Warning);
    }

    [Fact]
    public async Task TrailsMovedAsync_WithNoTrails_DoesNotTouchTheAreas()
    {
        await Build().TrailsMovedAsync([], TestContext.Current.CancellationToken);

        _repository.VerifyNoOtherCalls();
    }
}
