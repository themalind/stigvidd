// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Services.Facilities;

namespace UnitTests.ServiceTests;

public class FacilitySourceIdsTests
{
    [Fact]
    public void Of_JoinsTheSourceKeyAndTheSourcesId()
    {
        // Act
        var sourceId = FacilitySourceIds.Of(FacilitySourceIds.KeyFor("boras", "badplatser"), "1490-6472");

        // Assert
        sourceId.Should().Be("boras:badplatser:1490-6472");
    }

    [Theory]
    [InlineData("boras:badplatser:1490-6472", "boras:badplatser")]
    [InlineData("boras:badplatser:a:b", "boras:badplatser")]
    [InlineData("badplatser:12", "badplatser")]
    [InlineData("", null)]
    [InlineData(null, null)]
    public void KeyOf_ReturnsTheDataSourcePart(string? sourceId, string? expected)
    {
        // Act
        var key = FacilitySourceIds.KeyOf(sourceId);

        // Assert
        key.Should().Be(expected);
    }
}
