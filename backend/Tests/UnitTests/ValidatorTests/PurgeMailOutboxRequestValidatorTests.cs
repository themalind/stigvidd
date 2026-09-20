// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Validators.MailOutbox;
using WebDataContracts.RequestModels.MailOutbox;

namespace UnitTests.ValidatorTests;

/// <summary>
/// The two rules standing between a typo and an emptied outbox.
/// </summary>
public class PurgeMailOutboxRequestValidatorTests
{
    private readonly PurgeMailOutboxRequestValidator _validator = new();

    [Fact]
    public void AnOmittedOlderThanDays_IsRejected()
    {
        // Zero is the JSON default for an absent int. Without the floor, a client that simply
        // forgot the field would purge every sent mail in the table and be told it worked.
        // Arrange
        var request = new PurgeMailOutboxRequest { Confirm = true };

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(request.OlderThanDays));
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(3651)]
    public void AnOutOfRangeOlderThanDays_IsRejected(int days)
    {
        // Arrange
        var request = new PurgeMailOutboxRequest { OlderThanDays = days, Confirm = true };

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void WithoutConfirm_IsRejected()
    {
        // Arrange
        var request = new PurgeMailOutboxRequest { OlderThanDays = 30 };

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(request.Confirm));
    }

    [Fact]
    public void AConfirmedPurgeWithARealCutoff_IsAccepted()
    {
        // Arrange
        var request = new PurgeMailOutboxRequest { OlderThanDays = 1, Confirm = true };

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeTrue();
    }
}
