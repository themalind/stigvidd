using Core.Validators.PushToken;
using FluentAssertions;
using WebDataContracts.RequestModels.PushToken;

namespace UnitTests.ValidatorTests;

public class RegisterPushTokenRequestValidatorTests
{
    private readonly RegisterPushTokenRequestValidator _validator = new();

    private static RegisterPushTokenRequest ValidRequest() => new()
    {
        ExpoToken = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
        Platform = "android"
    };

    [Fact]
    public void Validate_WithValidData_ShouldPass()
    {
        var result = _validator.Validate(ValidRequest());
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithEmptyExpoToken_ShouldFail()
    {
        var request = ValidRequest();
        request.ExpoToken = string.Empty;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithExpoTokenAt255Characters_ShouldPass()
    {
        var request = ValidRequest();
        request.ExpoToken = new string('a', 255);

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithExpoTokenExceeding255Characters_ShouldFail()
    {
        var request = ValidRequest();
        request.ExpoToken = new string('a', 256);

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithEmptyPlatform_ShouldFail()
    {
        var request = ValidRequest();
        request.Platform = string.Empty;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithPlatformIos_ShouldPass()
    {
        var request = ValidRequest();
        request.Platform = "ios";

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithPlatformIosUppercase_ShouldPass()
    {
        var request = ValidRequest();
        request.Platform = "IOS";

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithPlatformAndroid_ShouldPass()
    {
        var request = ValidRequest();
        request.Platform = "android";

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithPlatformAndroidUppercase_ShouldPass()
    {
        var request = ValidRequest();
        request.Platform = "ANDROID";

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithInvalidPlatform_ShouldFail()
    {
        var request = ValidRequest();
        request.Platform = "web";

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }
}
