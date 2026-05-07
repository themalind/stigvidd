using Core.Validators;
using FluentAssertions;
using WebDataContracts.RequestModels.TrailObstacle;

namespace UnitTests.ValidatorTests;

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
