using Core.Validators;
using FluentAssertions;
using WebDataContracts.RequestModels.Review;
using WebDataContracts.RequestModels.Trail;
using WebDataContracts.RequestModels.TrailObstacle;
using WebDataContracts.RequestModels.User;

namespace UnitTests;

public class AddToUserFavoriteValidatorTests
{
    private readonly AddToUserFavoriteValidator _validator = new();

    [Fact]
    public void Validate_WithValidIdentifier_ShouldPass()
    {
        var result = _validator.Validate(new AddToUserFavoritesRequest
        {
            TrailIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c"
        });

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithEmptyIdentifier_ShouldFail()
    {
        var result = _validator.Validate(new AddToUserFavoritesRequest
        {
            TrailIdentifier = string.Empty
        });

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithIdentifierTooShort_ShouldFail()
    {
        var result = _validator.Validate(new AddToUserFavoritesRequest
        {
            TrailIdentifier = "too-short"
        });

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithIdentifierTooLong_ShouldFail()
    {
        var result = _validator.Validate(new AddToUserFavoritesRequest
        {
            TrailIdentifier = new string('a', 37)
        });

        result.IsValid.Should().BeFalse();
    }
}

public class AddToUserWishlistValidatorTests
{
    private readonly AddToUserWishlistValidator _validator = new();

    [Fact]
    public void Validate_WithValidIdentifier_ShouldPass()
    {
        var result = _validator.Validate(new AddToUserWishlistRequest
        {
            TrailIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c"
        });

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithEmptyIdentifier_ShouldFail()
    {
        var result = _validator.Validate(new AddToUserWishlistRequest
        {
            TrailIdentifier = string.Empty
        });

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithIdentifierTooShort_ShouldFail()
    {
        var result = _validator.Validate(new AddToUserWishlistRequest
        {
            TrailIdentifier = "too-short"
        });

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithIdentifierTooLong_ShouldFail()
    {
        var result = _validator.Validate(new AddToUserWishlistRequest
        {
            TrailIdentifier = new string('a', 37)
        });

        result.IsValid.Should().BeFalse();
    }
}

public class CreateUserRequestValidatorTests
{
    private readonly CreateUserRequestValidator _validator = new();

    [Fact]
    public void Validate_WithValidData_ShouldPass()
    {
        var result = _validator.Validate(new CreateUserRequest
        {
            Email = "test@example.com",
            NickName = "Vandrar"
        });

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithEmptyEmail_ShouldFail()
    {
        var result = _validator.Validate(new CreateUserRequest
        {
            Email = string.Empty,
            NickName = "Vandrar"
        });

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithInvalidEmailFormat_ShouldFail()
    {
        var result = _validator.Validate(new CreateUserRequest
        {
            Email = "not-an-email",
            NickName = "Vandrar"
        });

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithEmptyNickName_ShouldFail()
    {
        var result = _validator.Validate(new CreateUserRequest
        {
            Email = "test@example.com",
            NickName = string.Empty
        });

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithNickNameExceeding20Characters_ShouldFail()
    {
        var result = _validator.Validate(new CreateUserRequest
        {
            Email = "test@example.com",
            NickName = new string('a', 21)
        });

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithNickNameExactly20Characters_ShouldPass()
    {
        var result = _validator.Validate(new CreateUserRequest
        {
            Email = "test@example.com",
            NickName = new string('a', 20)
        });

        result.IsValid.Should().BeTrue();
    }
}

public class CreateReviewRequestValidatorTests
{
    private readonly CreateReviewRequestValidator _validator = new();

    [Fact]
    public void Validate_WithValidData_ShouldPass()
    {
        var result = _validator.Validate(new CreateReviewRequest
        {
            TrailIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c",
            TrailReview = "En fantastisk led!",
            Rating = 4.5M
        });

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithNullReview_ShouldPass()
    {
        var result = _validator.Validate(new CreateReviewRequest
        {
            TrailIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c",
            TrailReview = null,
            Rating = 3M
        });

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithReviewExceeding500Characters_ShouldFail()
    {
        var result = _validator.Validate(new CreateReviewRequest
        {
            TrailIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c",
            TrailReview = new string('a', 501),
            Rating = 3M
        });

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithReviewExactly500Characters_ShouldPass()
    {
        var result = _validator.Validate(new CreateReviewRequest
        {
            TrailIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c",
            TrailReview = new string('a', 500),
            Rating = 3M
        });

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithEmptyTrailIdentifier_ShouldFail()
    {
        var result = _validator.Validate(new CreateReviewRequest
        {
            TrailIdentifier = string.Empty,
            Rating = 3M
        });

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithTrailIdentifierWrongLength_ShouldFail()
    {
        var result = _validator.Validate(new CreateReviewRequest
        {
            TrailIdentifier = "too-short",
            Rating = 3M
        });

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithRatingAtMinBoundary_ShouldPass()
    {
        var result = _validator.Validate(new CreateReviewRequest
        {
            TrailIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c",
            Rating = 1M
        });

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithRatingAtMaxBoundary_ShouldPass()
    {
        var result = _validator.Validate(new CreateReviewRequest
        {
            TrailIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c",
            Rating = 5M
        });

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithRatingBelowMin_ShouldFail()
    {
        var result = _validator.Validate(new CreateReviewRequest
        {
            TrailIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c",
            Rating = 0.9M
        });

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithRatingAboveMax_ShouldFail()
    {
        var result = _validator.Validate(new CreateReviewRequest
        {
            TrailIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c",
            Rating = 5.1M
        });

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
        var result = _validator.Validate(ValidRequest());

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithEmptyName_ShouldFail()
    {
        var request = ValidRequest();
        request.Name = string.Empty;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithNameExceeding60Characters_ShouldFail()
    {
        var request = ValidRequest();
        request.Name = new string('a', 61);

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithTrailLengthZero_ShouldFail()
    {
        var request = ValidRequest();
        request.TrailLength = 0;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithNegativeTrailLength_ShouldFail()
    {
        var request = ValidRequest();
        request.TrailLength = -1;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithClassificationAbove3_ShouldFail()
    {
        var request = ValidRequest();
        request.Classification = 4;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithClassificationBelow0_ShouldFail()
    {
        var request = ValidRequest();
        request.Classification = -1;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithEmptyDescription_ShouldFail()
    {
        var request = ValidRequest();
        request.Description = string.Empty;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithDescriptionExceeding256Characters_ShouldFail()
    {
        var request = ValidRequest();
        request.Description = new string('a', 257);

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithAccessibilityInfoExceeding1024Characters_ShouldFail()
    {
        var request = ValidRequest();
        request.AccessibilityInfo = new string('a', 1025);

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithFullDescriptionExceeding1024Characters_ShouldFail()
    {
        var request = ValidRequest();
        request.FullDescription = new string('a', 1025);

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithTrailSymbolExceeding32Characters_ShouldFail()
    {
        var request = ValidRequest();
        request.TrailSymbol = new string('a', 33);

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithEmptyCity_ShouldFail()
    {
        var request = ValidRequest();
        request.City = string.Empty;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithCityExceeding128Characters_ShouldFail()
    {
        var request = ValidRequest();
        request.City = new string('a', 129);

        var result = _validator.Validate(request);

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
        var result = _validator.Validate(ValidRequest());

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithEmptyDescription_ShouldFail()
    {
        var request = ValidRequest();
        request.Description = string.Empty;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithDescriptionTooShort_ShouldFail()
    {
        var request = ValidRequest();
        request.Description = "För kort";

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithDescriptionExactly15Characters_ShouldPass()
    {
        var request = ValidRequest();
        request.Description = new string('a', 15);

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithDescriptionExceeding500Characters_ShouldFail()
    {
        var request = ValidRequest();
        request.Description = new string('a', 501);

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithEmptyIssueType_ShouldFail()
    {
        var request = ValidRequest();
        request.IssueType = string.Empty;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithEmptyTrailIdentifier_ShouldFail()
    {
        var request = ValidRequest();
        request.TrailIdentifier = string.Empty;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithTrailIdentifierWrongLength_ShouldFail()
    {
        var request = ValidRequest();
        request.TrailIdentifier = "too-short";

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithValidCoordinates_ShouldPass()
    {
        var request = ValidRequest();
        request.IncidentLongitude = 12.8382551042m;
        request.IncidentLatitude = 57.7291353665m;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithLongitudeAtMaxBoundary_ShouldPass()
    {
        var request = ValidRequest();
        request.IncidentLongitude = 180m;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithLongitudeExceedingMaxBoundary_ShouldFail()
    {
        var request = ValidRequest();
        request.IncidentLongitude = 180.0000000001m;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithLongitudeAtMinBoundary_ShouldPass()
    {
        var request = ValidRequest();
        request.IncidentLongitude = -180m;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithLongitudeBelowMinBoundary_ShouldFail()
    {
        var request = ValidRequest();
        request.IncidentLongitude = -180.0000000001m;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithLatitudeAtMaxBoundary_ShouldPass()
    {
        var request = ValidRequest();
        request.IncidentLatitude = 90m;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithLatitudeExceedingMaxBoundary_ShouldFail()
    {
        var request = ValidRequest();
        request.IncidentLatitude = 90.0000000001m;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithLatitudeAtMinBoundary_ShouldPass()
    {
        var request = ValidRequest();
        request.IncidentLatitude = -90m;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithLatitudeBelowMinBoundary_ShouldFail()
    {
        var request = ValidRequest();
        request.IncidentLatitude = -90.0000000001m;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithNullCoordinates_ShouldPass()
    {
        var request = ValidRequest();
        request.IncidentLongitude = null;
        request.IncidentLatitude = null;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }
}
