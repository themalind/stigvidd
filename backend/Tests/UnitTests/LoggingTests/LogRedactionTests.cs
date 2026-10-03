// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Logging;

namespace UnitTests.LoggingTests;

public class LogRedactionTests
{
    [Theory]
    [InlineData("anna.berg@example.se", "***@example.se")]
    [InlineData("Anna@Sub.Example.COM ", "***@Sub.Example.COM")]
    [InlineData("no-at-sign", "***")]
    [InlineData("trailing@", "***")]
    [InlineData("", "***")]
    [InlineData(null, "***")]
    public void MaskEmail_KeepsOnlyTheDomain(string? email, string expected)
    {
        // Act
        var masked = LogRedaction.MaskEmail(email);

        // Assert
        masked.Should().Be(expected);
    }

    [Fact]
    public void ScrubEmails_RemovesTheMailboxFromAnSmtpReply()
    {
        // Arrange
        const string reply = "5.1.1 <anna.berg+hikes@example.se>: Recipient address rejected: User unknown";

        // Act
        var scrubbed = LogRedaction.ScrubEmails(reply);

        // Assert
        scrubbed.Should().Be("5.1.1 <***@example.se>: Recipient address rejected: User unknown");
    }

    [Fact]
    public void ScrubEmails_RemovesEveryAddressInTheText()
    {
        // Act
        var scrubbed = LogRedaction.ScrubEmails("from a@one.se to b.c@two.example.org");

        // Assert
        scrubbed.Should().Be("from ***@one.se to ***@two.example.org");
    }

    [Theory]
    [InlineData(null, "")]
    [InlineData("", "")]
    [InlineData("421 4.7.0 Try again later", "421 4.7.0 Try again later")]
    public void ScrubEmails_LeavesTextWithoutAddressesAlone(string? text, string expected)
    {
        // Act
        var scrubbed = LogRedaction.ScrubEmails(text);

        // Assert
        scrubbed.Should().Be(expected);
    }
}
