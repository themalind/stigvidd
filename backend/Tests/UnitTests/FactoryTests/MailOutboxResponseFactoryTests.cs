// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Factories;
using Core.Interfaces.Repositories;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using WebDataContracts.ResponseModels.MailOutbox;

namespace UnitTests.FactoryTests;

public class MailOutboxResponseFactoryTests
{
    private readonly MailOutboxResponseFactory _factory = new();

    [Fact]
    public void ASummaryResponseExposesNoMailBody()
    {
        // The list must never carry rendered bodies: a page of them is megabytes on the wire.
        // The wire shape is what enforces it, so it is worth pinning.
        // Act
        var properties = typeof(WebDataContracts.ResponseModels.MailOutbox.OutboxEmailSummaryResponse)
            .GetProperties()
            .Select(p => p.Name);

        // Assert
        properties.Should().NotContain(["BodyHtml", "BodyText"]);
    }

    [Fact]
    public void TheStatusReachesTheWireAsAName()
    {
        // Arrange
        var summary = new OutboxEmailSummary(
            "mail-1", "vandrare@example.com", null, "Hej", "welcome",
            OutboxEmailStatus.Cancelled, 0, DateTime.UtcNow, null, null,
            null, null, DateTime.UtcNow, DateTime.UtcNow);

        // Act
        var response = _factory.Create(summary);

        // Assert
        response.Status.Should().Be("Cancelled");
    }

    [Fact]
    public void AStatusWithNoRowsStillRendersAZero()
    {
        // Otherwise the page shows nothing where it should show "0 failed", which reads as
        // missing data rather than good news.
        // Arrange
        var counts = new Dictionary<OutboxEmailStatus, int> { [OutboxEmailStatus.Sent] = 4 };

        // Act
        var response = _factory.Create(counts);

        // Assert
        response.Sent.Should().Be(4);
        response.Failed.Should().Be(0);
        response.Cancelled.Should().Be(0);
        response.Total.Should().Be(4);
    }

    // The bodies moved off the detail response and behind their own logged route, so that
    // browsing the outbox no longer fetches a nickname and a live token URL for every row an
    // operator clicks. This is the assertion that says the split is real.
    [Fact]
    public void TheDetailResponseCarriesNeitherBody()
    {
        // Arrange
        var email = new OutboxEmail
        {
            Identifier = "mail-1",
            ToAddress = "vandrare@example.com",
            Subject = "Hej",
            BodyHtml = "<p>Hej</p>",
            BodyText = "Hej",
            Status = OutboxEmailStatus.Sent,
        };

        // Act
        var response = _factory.Create(email);

        // Assert
        response.Email.Identifier.Should().Be("mail-1");
        typeof(OutboxEmailDetailResponse).GetProperties().Select(p => p.Name)
            .Should().NotContain(["BodyHtml", "BodyText"]);
    }

    [Fact]
    public void TheBodyResponseCarriesBothBodies()
    {
        // Arrange
        var email = new OutboxEmail
        {
            Identifier = "mail-1",
            ToAddress = "vandrare@example.com",
            Subject = "Hej",
            BodyHtml = "<p>Hej</p>",
            BodyText = "Hej",
            Status = OutboxEmailStatus.Sent,
        };

        // Act
        var response = _factory.CreateBody(email);

        // Assert
        response.Identifier.Should().Be("mail-1");
        response.BodyHtml.Should().Be("<p>Hej</p>");
        response.BodyText.Should().Be("Hej");
    }

    [Fact]
    public void TheSummaryCarriesTheRetentionTimestamps()
    {
        // Arrange
        var settled = new DateTime(2026, 9, 1, 8, 0, 0, DateTimeKind.Utc);
        var redacted = new DateTime(2026, 9, 2, 8, 0, 0, DateTimeKind.Utc);
        var email = new OutboxEmail
        {
            Identifier = "mail-1",
            ToAddress = "vandrare@example.com",
            Subject = "Hej",
            BodyHtml = string.Empty,
            BodyText = string.Empty,
            Status = OutboxEmailStatus.Failed,
            SettledAt = settled,
            RedactedAt = redacted,
        };

        // Act
        var response = _factory.CreateSummary(email);

        // Assert
        // RedactedAt has to reach the browser: it is what lets the page say the body is gone
        // rather than mount an empty preview that reads as a broken render.
        response.SettledAt.Should().Be(settled);
        response.RedactedAt.Should().Be(redacted);
    }
}
