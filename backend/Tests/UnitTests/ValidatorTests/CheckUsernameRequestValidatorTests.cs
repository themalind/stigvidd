using Core.Validators.Friends;
using FluentAssertions;
using WebDataContracts.RequestModels.User;

namespace UnitTests.ValidatorTests;

public class CheckUsernameRequestValidatorTests
{
    private readonly CheckUsernameRequestValidator _validator = new();

    // --- Username ---

    [Fact]
    public void Validate_WithValidUsername_ShouldPass()
    {
        var request = new CheckUsernameRequest { Username = "anna92" };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithEmptyUsername_ShouldFail()
    {
        var request = new CheckUsernameRequest { Username = string.Empty };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithUsernameAtMaxLength_ShouldPass()
    {
        var request = new CheckUsernameRequest { Username = new string('a', 20) };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithUsernameExceedingMaxLength_ShouldFail()
    {
        var request = new CheckUsernameRequest { Username = new string('a', 21) };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }
}
