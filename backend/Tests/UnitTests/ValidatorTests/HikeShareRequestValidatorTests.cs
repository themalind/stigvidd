using Core.Validators.HikeShare;
using FluentAssertions;
using WebDataContracts.RequestModels.HikeShare;

namespace UnitTests.ValidatorTests;

public class HikeShareRequestValidatorTests
{
    private readonly HikeShareRequestValidator _validator = new();

    private static HikeShareRequest ValidRequest() => new()
    {
        HikeIdentifier = "3f9c1b7e-8a42-4e6d-9c5f-2a7b1d8e4f90",
        SharedWithName = "NaturElskaren"
    };

    [Fact]
    public void Validate_WithValidData_ShouldPass()
    {
        var result = _validator.Validate(ValidRequest());
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithEmptyHikeIdentifier_ShouldFail()
    {
        var request = ValidRequest();
        request.HikeIdentifier = string.Empty;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithHikeIdentifierTooShort_ShouldFail()
    {
        var request = ValidRequest();
        request.HikeIdentifier = "too-short";

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithHikeIdentifierTooLong_ShouldFail()
    {
        var request = ValidRequest();
        request.HikeIdentifier = new string('a', 37);

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithHikeIdentifierExactly36Characters_ShouldPass()
    {
        var request = ValidRequest();
        request.HikeIdentifier = new string('a', 36);

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithEmptySharedWithName_ShouldFail()
    {
        var request = ValidRequest();
        request.SharedWithName = string.Empty;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithSharedWithNameAt20Characters_ShouldPass()
    {
        var request = ValidRequest();
        request.SharedWithName = new string('a', 20);

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithSharedWithNameExceeding20Characters_ShouldFail()
    {
        var request = ValidRequest();
        request.SharedWithName = new string('a', 21);

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }
}
