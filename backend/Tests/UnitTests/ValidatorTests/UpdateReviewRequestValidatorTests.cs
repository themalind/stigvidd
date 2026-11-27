// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Validators.Trails;
using WebDataContracts.RequestModels.Review;

namespace UnitTests.ValidatorTests;

public class UpdateReviewRequestValidatorTests
{
    private readonly UpdateReviewRequestValidator _validator = new();

    [Fact]
    public void Validate_WithValidData_Passes()
    {
        // Arrange
        var request = new UpdateReviewRequest { Rating = 4M, TrailReview = "Fin led", RemovedImageIdentifiers = ["img-1"] };

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithoutTextOrRemovedImages_Passes()
    {
        // Arrange
        var request = new UpdateReviewRequest { Rating = 4M };

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData(1)]
    [InlineData(5)]
    public void Validate_WithRatingOnTheBoundary_Passes(decimal rating)
    {
        // Act
        var result = _validator.Validate(new UpdateReviewRequest { Rating = rating });

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(0.9)]
    [InlineData(5.1)]
    public void Validate_WithRatingOutOfRange_Fails(decimal rating)
    {
        // Act
        var result = _validator.Validate(new UpdateReviewRequest { Rating = rating });

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithRatingOutOfRange_NamesTheAllowedRange()
    {
        // Act
        var result = _validator.Validate(new UpdateReviewRequest { Rating = 0M });

        // Assert
        result.Errors.Should().ContainSingle().Which.ErrorMessage.Should().Contain("1").And.Contain("5");
    }

    [Fact]
    public void Validate_WithTextAtTheLimit_Passes()
    {
        // Act
        var result = _validator.Validate(new UpdateReviewRequest { Rating = 3M, TrailReview = new string('a', 500) });

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithTextOverTheLimit_Fails()
    {
        // Act
        var result = _validator.Validate(new UpdateReviewRequest { Rating = 3M, TrailReview = new string('a', 501) });

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithABlankImageIdentifier_Fails()
    {
        // Act
        var result = _validator.Validate(new UpdateReviewRequest { Rating = 3M, RemovedImageIdentifiers = [""] });

        // Assert
        result.IsValid.Should().BeFalse();
    }
}
