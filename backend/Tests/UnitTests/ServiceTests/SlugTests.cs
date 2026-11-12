// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Services;

namespace UnitTests.ServiceTests;

public class SlugTests
{
    [Theory]
    [InlineData("Borås", "boras")]
    [InlineData("Härryda", "harryda")]
    [InlineData("Upplands Väsby", "upplands-vasby")]
    [InlineData("  Öckerö  ", "ockero")]
    [InlineData("Malung-Sälen", "malung-salen")]
    [InlineData("Lilla  Edet!", "lilla-edet")]
    [InlineData("-", "")]
    public void From_GivesLowercaseAsciiWithSingleDashes(string name, string expected)
    {
        // Act
        var slug = Slug.From(name);

        // Assert
        slug.Should().Be(expected);
    }

    [Theory]
    [InlineData("Borås", true)]
    [InlineData("--", false)]
    [InlineData("", false)]
    public void Fits_NeedsAtLeastOneLetterOrDigit(string name, bool expected)
    {
        // Act
        var fits = Slug.Fits(name);

        // Assert
        fits.Should().Be(expected);
    }

    [Fact]
    public void Fits_RefusesMoreThanMaxLength()
    {
        // Act
        var atMax = Slug.Fits(new string('a', Slug.MaxLength));
        var over = Slug.Fits(new string('a', Slug.MaxLength + 1));

        // Assert
        atMax.Should().BeTrue();
        over.Should().BeFalse();
    }
}
