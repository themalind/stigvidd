using Core.Validators;
using FluentAssertions;
using WebDataContracts.RequestModels.User;

namespace UnitTests.ValidatorTests;

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
