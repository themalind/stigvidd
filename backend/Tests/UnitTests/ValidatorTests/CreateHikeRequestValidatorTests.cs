using Core.Validators.Hike;
using FluentAssertions;
using WebDataContracts.RequestModels.Hike;

namespace UnitTests.ValidatorTests;

public class CreateHikeRequestValidatorTests
{
    private readonly CreateHikeRequestValidator _validator = new();

    private static CreateHikeRequest ValidRequest() => new()
    {
        Name = "Sommarleden",
        HikeLength = 5.0m,
        Duration = 90,
        Coordinates = "59.3293,18.0686",
    };

    // --- Name ---

    [Fact]
    public void Validate_WithValidName_ShouldPass()
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
    public void Validate_WithNameAtMaxLength_ShouldPass()
    {
        var request = ValidRequest();
        request.Name = new string('a', 40);

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithNameExceedingMaxLength_ShouldFail()
    {
        var request = ValidRequest();
        request.Name = new string('a', 41);

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    // --- HikeLength ---

    [Fact]
    public void Validate_WithHikeLengthGreaterThanZero_ShouldPass()
    {
        var request = ValidRequest();
        request.HikeLength = 0.1m;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithHikeLengthZero_ShouldFail()
    {
        var request = ValidRequest();
        request.HikeLength = 0;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithNegativeHikeLength_ShouldFail()
    {
        var request = ValidRequest();
        request.HikeLength = -1m;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    // --- Duration ---

    [Fact]
    public void Validate_WithDurationGreaterThanZero_ShouldPass()
    {
        var request = ValidRequest();
        request.Duration = 1;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithDurationZero_ShouldFail()
    {
        var request = ValidRequest();
        request.Duration = 0;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithNegativeDuration_ShouldFail()
    {
        var request = ValidRequest();
        request.Duration = -1;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    // --- Coordinates ---

    [Fact]
    public void Validate_WithValidCoordinates_ShouldPass()
    {
        var request = ValidRequest();
        request.Coordinates = "59.3293,18.0686";

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithEmptyCoordinates_ShouldFail()
    {
        var request = ValidRequest();
        request.Coordinates = string.Empty;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    // --- ParkingInfo ---

    [Fact]
    public void Validate_WithNullParkingInfo_ShouldPass()
    {
        var request = ValidRequest();
        request.ParkingInfo = null;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithValidParkingInfo_ShouldPass()
    {
        var request = ValidRequest();
        request.ParkingInfo = "Gratis parkering vid entrén.";

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithEmptyParkingInfo_ShouldFail()
    {
        var request = ValidRequest();
        request.ParkingInfo = string.Empty;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithParkingInfoExceedingMaxLength_ShouldFail()
    {
        var request = ValidRequest();
        request.ParkingInfo = new string('a', 201);

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    // --- GettingThere ---

    [Fact]
    public void Validate_WithNullGettingThere_ShouldPass()
    {
        var request = ValidRequest();
        request.GettingThere = null;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithValidGettingThere_ShouldPass()
    {
        var request = ValidRequest();
        request.GettingThere = "Ta buss 500 och gå 200 m.";

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithEmptyGettingThere_ShouldFail()
    {
        var request = ValidRequest();
        request.GettingThere = string.Empty;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithGettingThereExceedingMaxLength_ShouldFail()
    {
        var request = ValidRequest();
        request.GettingThere = new string('a', 201);

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    // --- Description ---

    [Fact]
    public void Validate_WithNullDescription_ShouldPass()
    {
        var request = ValidRequest();
        request.Description = null;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithValidDescription_ShouldPass()
    {
        var request = ValidRequest();
        request.Description = "En fin promenad längs sjön.";

        var result = _validator.Validate(request);

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
    public void Validate_WithDescriptionExceedingMaxLength_ShouldFail()
    {
        var request = ValidRequest();
        request.Description = new string('a', 501);

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }
}
