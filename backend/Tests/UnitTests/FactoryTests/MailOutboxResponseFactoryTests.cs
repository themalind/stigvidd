// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Factories;
using Core.Interfaces.Repositories;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;

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
            DateTime.UtcNow, DateTime.UtcNow);

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

    [Fact]
    public void TheDetailResponseCarriesBothBodies()
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
        response.BodyHtml.Should().Be("<p>Hej</p>");
        response.BodyText.Should().Be("Hej");
        response.Email.Identifier.Should().Be("mail-1");
    }
}
