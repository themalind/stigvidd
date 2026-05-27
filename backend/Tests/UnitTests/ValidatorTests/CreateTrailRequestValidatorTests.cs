using Core.Validators.Trail;
using FluentAssertions;
using WebDataContracts.RequestModels.Trail;

namespace UnitTests.ValidatorTests;

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
