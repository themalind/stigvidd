using Core.Validators.User;
using FluentAssertions;
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
