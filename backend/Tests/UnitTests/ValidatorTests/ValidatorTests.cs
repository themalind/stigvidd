using Core.Validators;
using FluentAssertions;
using WebDataContracts.RequestModels.Review;
using WebDataContracts.RequestModels.Trail;
using WebDataContracts.RequestModels.TrailObstacle;
using WebDataContracts.RequestModels.User;

namespace UnitTests.ValidatorTests;

public class AddToUserFavoriteValidatorTests
{
    private readonly AddToUserFavoriteValidator _validator = new();

    [Fact]
    public void Validate_WithValidIdentifier_ShouldPass()
    {
        // Arrange
        var request = new AddToUserFavoritesRequest { TrailIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c" };

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithEmptyIdentifier_ShouldFail()
    {
        // Arrange
        var request = new AddToUserFavoritesRequest { TrailIdentifier = string.Empty };

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithIdentifierTooShort_ShouldFail()
    {
        // Arrange
        var request = new AddToUserFavoritesRequest { TrailIdentifier = "too-short" };

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithIdentifierTooLong_ShouldFail()
    {
        // Arrange
        var request = new AddToUserFavoritesRequest { TrailIdentifier = new string('a', 37) };

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }
}

public class AddToUserWishlistValidatorTests
{
    private readonly AddToUserWishlistValidator _validator = new();

    [Fact]
    public void Validate_WithValidIdentifier_ShouldPass()
    {
        // Arrange
        var request = new AddToUserWishlistRequest { TrailIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c" };

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithEmptyIdentifier_ShouldFail()
    {
        // Arrange
        var request = new AddToUserWishlistRequest { TrailIdentifier = string.Empty };

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithIdentifierTooShort_ShouldFail()
    {
        // Arrange
        var request = new AddToUserWishlistRequest { TrailIdentifier = "too-short" };

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithIdentifierTooLong_ShouldFail()
    {
        // Arrange
        var request = new AddToUserWishlistRequest { TrailIdentifier = new string('a', 37) };

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }
}

public class CreateUserRequestValidatorTests
{
    private readonly CreateUserRequestValidator _validator = new();

    [Fact]
    public void Validate_WithValidData_ShouldPass()
    {
        // Arrange
        var request = new CreateUserRequest { Email = "test@example.com", NickName = "Vandrar" };

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithEmptyEmail_ShouldFail()
    {
        // Arrange
        var request = new CreateUserRequest { Email = string.Empty, NickName = "Vandrar" };

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithInvalidEmailFormat_ShouldFail()
    {
        // Arrange
        var request = new CreateUserRequest { Email = "not-an-email", NickName = "Vandrar" };

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithEmptyNickName_ShouldFail()
    {
        // Arrange
        var request = new CreateUserRequest { Email = "test@example.com", NickName = string.Empty };

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithNickNameExceeding20Characters_ShouldFail()
    {
        // Arrange
        var request = new CreateUserRequest { Email = "test@example.com", NickName = new string('a', 21) };

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithNickNameExactly20Characters_ShouldPass()
    {
        // Arrange
        var request = new CreateUserRequest { Email = "test@example.com", NickName = new string('a', 20) };

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeTrue();
    }
}

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

public class CreateTrailRequestValidatorTests
{
    private readonly CreateTrailRequestValidator _validator = new();

    private static CreateTrailRequest ValidRequest() => new()
    {
        Name = "Tiveden",
        TrailLength = 9.5M,
        Classification = 2,
        Description = "En fin led genom skogen.",
        City = "Tiveden",
        Coordinates = "[]"
    };

    [Fact]
    public void Validate_WithValidData_ShouldPass()
    {
        // Arrange
        var request = ValidRequest();

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithEmptyName_ShouldFail()
    {
        // Arrange
        var request = ValidRequest();
        request.Name = string.Empty;

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithNameExceeding60Characters_ShouldFail()
    {
        // Arrange
        var request = ValidRequest();
        request.Name = new string('a', 61);

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithTrailLengthZero_ShouldFail()
    {
        // Arrange
        var request = ValidRequest();
        request.TrailLength = 0;

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithNegativeTrailLength_ShouldFail()
    {
        // Arrange
        var request = ValidRequest();
        request.TrailLength = -1;

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithClassificationAbove3_ShouldFail()
    {
        // Arrange
        var request = ValidRequest();
        request.Classification = 4;

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithClassificationBelow0_ShouldFail()
    {
        // Arrange
        var request = ValidRequest();
        request.Classification = -1;

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithEmptyDescription_ShouldFail()
    {
        // Arrange
        var request = ValidRequest();
        request.Description = string.Empty;

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithDescriptionExceeding256Characters_ShouldFail()
    {
        // Arrange
        var request = ValidRequest();
        request.Description = new string('a', 257);

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithAccessibilityInfoExceeding1024Characters_ShouldFail()
    {
        // Arrange
        var request = ValidRequest();
        request.AccessibilityInfo = new string('a', 1025);

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithFullDescriptionExceeding1024Characters_ShouldFail()
    {
        // Arrange
        var request = ValidRequest();
        request.FullDescription = new string('a', 1025);

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithTrailSymbolExceeding32Characters_ShouldFail()
    {
        // Arrange
        var request = ValidRequest();
        request.TrailSymbol = new string('a', 33);

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithEmptyCity_ShouldFail()
    {
        // Arrange
        var request = ValidRequest();
        request.City = string.Empty;

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithCityExceeding128Characters_ShouldFail()
    {
        // Arrange
        var request = ValidRequest();
        request.City = new string('a', 129);

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }
}

public class TrailObstacleRequestValidatorTests
{
    private readonly TrailObstacleRequestValidator _validator = new();

    private static TrailObstacleRequest ValidRequest() => new()
    {
        TrailIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c",
        Description = "Stort träd blockerar stigen.",
        IssueType = "FallenTree"
    };

    [Fact]
    public void Validate_WithValidData_ShouldPass()
    {
        // Arrange
        var request = ValidRequest();

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithEmptyDescription_ShouldFail()
    {
        // Arrange
        var request = ValidRequest();
        request.Description = string.Empty;

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithDescriptionTooShort_ShouldFail()
    {
        // Arrange
        var request = ValidRequest();
        request.Description = "För kort";

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithDescriptionExactly15Characters_ShouldPass()
    {
        // Arrange
        var request = ValidRequest();
        request.Description = new string('a', 15);

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithDescriptionExceeding500Characters_ShouldFail()
    {
        // Arrange
        var request = ValidRequest();
        request.Description = new string('a', 501);

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithEmptyIssueType_ShouldFail()
    {
        // Arrange
        var request = ValidRequest();
        request.IssueType = string.Empty;

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithEmptyTrailIdentifier_ShouldFail()
    {
        // Arrange
        var request = ValidRequest();
        request.TrailIdentifier = string.Empty;

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithTrailIdentifierWrongLength_ShouldFail()
    {
        // Arrange
        var request = ValidRequest();
        request.TrailIdentifier = "too-short";

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithValidCoordinates_ShouldPass()
    {
        // Arrange
        var request = ValidRequest();
        request.IncidentLongitude = 12.8382551042m;
        request.IncidentLatitude = 57.7291353665m;

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithLongitudeAtMaxBoundary_ShouldPass()
    {
        // Arrange
        var request = ValidRequest();
        request.IncidentLongitude = 180m;

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithLongitudeExceedingMaxBoundary_ShouldFail()
    {
        // Arrange
        var request = ValidRequest();
        request.IncidentLongitude = 180.0000000001m;

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithLongitudeAtMinBoundary_ShouldPass()
    {
        // Arrange
        var request = ValidRequest();
        request.IncidentLongitude = -180m;

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithLongitudeBelowMinBoundary_ShouldFail()
    {
        // Arrange
        var request = ValidRequest();
        request.IncidentLongitude = -180.0000000001m;

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithLatitudeAtMaxBoundary_ShouldPass()
    {
        // Arrange
        var request = ValidRequest();
        request.IncidentLatitude = 90m;

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithLatitudeExceedingMaxBoundary_ShouldFail()
    {
        // Arrange
        var request = ValidRequest();
        request.IncidentLatitude = 90.0000000001m;

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithLatitudeAtMinBoundary_ShouldPass()
    {
        // Arrange
        var request = ValidRequest();
        request.IncidentLatitude = -90m;

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithLatitudeBelowMinBoundary_ShouldFail()
    {
        // Arrange
        var request = ValidRequest();
        request.IncidentLatitude = -90.0000000001m;

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithNullCoordinates_ShouldPass()
    {
        // Arrange
        var request = ValidRequest();
        request.IncidentLongitude = null;
        request.IncidentLatitude = null;

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeTrue();
    }
}
