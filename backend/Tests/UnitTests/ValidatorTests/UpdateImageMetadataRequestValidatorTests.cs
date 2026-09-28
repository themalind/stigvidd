// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Validators.Media;
using WebDataContracts.RequestModels.Media;

namespace UnitTests.ValidatorTests;

public class UpdateImageMetadataRequestValidatorTests
{
    private readonly UpdateImageMetadataRequestValidator _validator = new();

    [Fact]
    public void TextsAtTheLimit_AreAccepted()
    {
        // Arrange
        var request = new UpdateImageMetadataRequest
        {
            AltText = new string('a', UpdateImageMetadataRequestValidator.MaxLength),
            Caption = new string('c', UpdateImageMetadataRequestValidator.MaxLength),
        };

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void AnAltTextOrCaptionOverTheLimit_IsRefused(bool altText)
    {
        // Arrange
        var tooLong = new string('x', UpdateImageMetadataRequestValidator.MaxLength + 1);
        var request = altText
            ? new UpdateImageMetadataRequest { AltText = tooLong }
            : new UpdateImageMetadataRequest { Caption = tooLong };

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().ContainSingle(e =>
            e.PropertyName == (altText ? nameof(UpdateImageMetadataRequest.AltText) : nameof(UpdateImageMetadataRequest.Caption)));
    }
}
