// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Services.Facilities;

namespace UnitTests.ServiceTests;

public class FacilityNamesTests
{
    [Theory]
    [InlineData("Dalsjöns badplats", "dalsjön")]
    [InlineData("Dalsjön badplats", "dalsjön")]
    [InlineData("Kommunala badplatsen, Öresjö", "öresjö")]
    [InlineData("Grillplats - Kypegården", "kypegården")]
    [InlineData("Vindskydd", "")]
    public void Key_DropsNoiseGenitiveAndPunctuation(string name, string expected)
    {
        // Act
        var key = FacilityNames.Key(name);

        // Assert
        key.Should().Be(expected);
    }
}
