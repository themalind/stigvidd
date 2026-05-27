using Core.Validators.Review;
using FluentAssertions;
using WebDataContracts.RequestModels.Review;

namespace UnitTests.ValidatorTests;

public class CreateReviewRequestValidatorTests
{
    private readonly CreateReviewRequestValidator _validator = new();

    [Fact]
    public void Validate_WithValidData_ShouldPass()
    {
        // Arrange
        var request = new CreateReviewRequest
        {
            TrailIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c",
            TrailReview = "En fantastisk led!",
            Rating = 4.5M
        };

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithNullReview_ShouldPass()
    {
        // Arrange
        var request = new CreateReviewRequest
        {
            TrailIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c",
            TrailReview = null,
            Rating = 3M
        };

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithReviewExceeding500Characters_ShouldFail()
    {
        // Arrange
        var request = new CreateReviewRequest
        {
            TrailIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c",
            TrailReview = new string('a', 501),
            Rating = 3M
        };

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithReviewExactly500Characters_ShouldPass()
    {
        // Arrange
        var request = new CreateReviewRequest
        {
            TrailIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c",
            TrailReview = new string('a', 500),
            Rating = 3M
        };

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithEmptyTrailIdentifier_ShouldFail()
    {
        // Arrange
        var request = new CreateReviewRequest { TrailIdentifier = string.Empty, Rating = 3M };

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithTrailIdentifierWrongLength_ShouldFail()
    {
        // Arrange
        var request = new CreateReviewRequest { TrailIdentifier = "too-short", Rating = 3M };

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithRatingAtMinBoundary_ShouldPass()
    {
        // Arrange
        var request = new CreateReviewRequest { TrailIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c", Rating = 1M };

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithRatingAtMaxBoundary_ShouldPass()
    {
        // Arrange
        var request = new CreateReviewRequest { TrailIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c", Rating = 5M };

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithRatingBelowMin_ShouldFail()
    {
        // Arrange
        var request = new CreateReviewRequest { TrailIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c", Rating = 0.9M };

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithRatingAboveMax_ShouldFail()
    {
        // Arrange
        var request = new CreateReviewRequest { TrailIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c", Rating = 5.1M };

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }
}
