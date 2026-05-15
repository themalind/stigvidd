using Core.Validators;
using FluentAssertions;
using WebDataContracts.RequestModels.Friend;

namespace UnitTests.ValidatorTests;

public class SendFriendRequestRequestValidatorTests
{
    private readonly SendFriendRequestRequestValidator _validator = new();

    private static SendFriendRequestRequest ValidRequest() => new()
    {
        ReceiverNickName = "Gandalf"
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
    public void Validate_WithEmptyReceiverNickName_ShouldFail()
    {
        // Arrange
        var request = ValidRequest();
        request.ReceiverNickName = string.Empty;

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.ErrorMessage == "Receiver nickname is required.");
    }

    [Fact]
    public void Validate_WithWhitespaceReceiverNickName_ShouldFail()
    {
        // Arrange
        var request = ValidRequest();
        request.ReceiverNickName = "   ";

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithReceiverNickNameAt20Characters_ShouldPass()
    {
        // Arrange
        var request = ValidRequest();
        request.ReceiverNickName = new string('a', 20);

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithReceiverNickNameExceeding20Characters_ShouldFail()
    {
        // Arrange
        var request = ValidRequest();
        request.ReceiverNickName = new string('a', 21);

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.ErrorMessage == "Receiver nickname must not exceed 20 characters.");
    }

    [Fact]
    public void Validate_WithReceiverNickNameAt1Character_ShouldPass()
    {
        // Arrange
        var request = ValidRequest();
        request.ReceiverNickName = "a";

        // Act
        var result = _validator.Validate(request);

        // Assert
        result.IsValid.Should().BeTrue();
    }
}
