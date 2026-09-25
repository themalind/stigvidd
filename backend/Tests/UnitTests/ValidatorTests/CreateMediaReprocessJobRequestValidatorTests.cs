// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Services;
using Core.Validators.Media;
using WebDataContracts.RequestModels.Media;

namespace UnitTests.ValidatorTests;

public class CreateMediaReprocessJobRequestValidatorTests
{
    private readonly CreateMediaReprocessJobRequestValidator _validator = new();

    private static CreateMediaReprocessJobRequest MakeRequest(
        IReadOnlyCollection<string>? identifiers = null, ImageProcessingOptionsRequest? options = null) => new()
    {
        MediaIdentifiers = identifiers ?? ["media-1"],
        Options = options ?? new ImageProcessingOptionsRequest { MaxWidth = 800 },
    };

    [Fact]
    public void AnEmptyIdentifierList_IsRejected()
    {
        // Arrange
        var request = MakeRequest(identifiers: []);

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(request.MediaIdentifiers));
    }

    [Fact]
    public void ABlankIdentifierInTheList_IsRejected()
    {
        // Arrange
        var request = MakeRequest(identifiers: ["media-1", "  "]);

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void MoreThanTheExplicitCapOfIdentifiers_IsRejected()
    {
        // Arrange
        var request = MakeRequest(identifiers: Enumerable.Range(1, MediaReprocessLimits.MaxExplicitBatchSize + 1).Select(i => $"media-{i}").ToList());

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void ExactlyTheExplicitCapOfIdentifiers_IsAccepted()
    {
        // Arrange
        var request = MakeRequest(identifiers: Enumerable.Range(1, MediaReprocessLimits.MaxExplicitBatchSize).Select(i => $"media-{i}").ToList());

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void AMaxWidthThatIsNotPositive_IsRejected(int maxWidth)
    {
        // Arrange
        var request = MakeRequest(options: new ImageProcessingOptionsRequest { MaxWidth = maxWidth });

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(101)]
    public void AQualityOutsideOneToOneHundred_IsRejected(int quality)
    {
        // Arrange
        var request = MakeRequest(options: new ImageProcessingOptionsRequest { Quality = quality });

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void OptionsWithNothingSet_IsAccepted()
    {
        // Arrange
        var request = MakeRequest(options: new ImageProcessingOptionsRequest());

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void AWellFormedRequest_IsAccepted()
    {
        // Arrange
        var request = MakeRequest(
            identifiers: ["media-1", "media-2"],
            options: new ImageProcessingOptionsRequest { MaxWidth = 1600, MaxHeight = 1600, Quality = 80, Format = "webp" });

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void TheExplicitCapIsTwoThousand()
    {
        // Assert
        MediaReprocessLimits.MaxExplicitBatchSize.Should().Be(2000);
    }

    [Fact]
    public void AFilterOnItsOwn_IsAccepted()
    {
        // Arrange
        var request = new CreateMediaReprocessJobRequest
        {
            Filter = new MediaFilter { TargetMaxWidth = 800, TargetFormat = "webp" },
            Options = new ImageProcessingOptionsRequest { MaxWidth = 800, Quality = 50, Format = "webp" },
        };

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void NeitherIdentifiersNorFilter_IsRejected()
    {
        // Arrange
        var request = new CreateMediaReprocessJobRequest
        {
            Options = new ImageProcessingOptionsRequest { MaxWidth = 800 },
        };

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void BothIdentifiersAndFilter_IsRejected()
    {
        // Arrange
        var request = new CreateMediaReprocessJobRequest
        {
            MediaIdentifiers = ["media-1"],
            Filter = new MediaFilter { TargetMaxWidth = 800 },
            Options = new ImageProcessingOptionsRequest { MaxWidth = 800 },
        };

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void AFilterWhoseMinExceedsItsMax_IsRejected()
    {
        // Arrange
        var request = new CreateMediaReprocessJobRequest
        {
            Filter = new MediaFilter { MinWidth = 900, MaxWidth = 100 },
            Options = new ImageProcessingOptionsRequest { MaxWidth = 800 },
        };

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void AMisspelledOutputFormat_IsRejected()
    {
        // Arrange
        var request = MakeRequest(options: new ImageProcessingOptionsRequest { Format = "wepb" });

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Theory]
    [InlineData("WebP")]
    [InlineData(" jpeg ")]
    [InlineData("original")]
    public void AKnownOutputFormat_IsAccepted(string format)
    {
        // Arrange
        var request = MakeRequest(options: new ImageProcessingOptionsRequest { Format = format });

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeTrue();
    }
}
