using Core.Validators;
using FluentAssertions;
using WebDataContracts.RequestModels.Facility;

namespace UnitTests.ValidatorTests;

public class UpdateFacilityRequestValidatorTests
{
    private readonly UpdateFacilityRequestValidator _validator = new();

    private static UpdateFacilityRequest EmptyRequest() => new();

    // --- All null (no fields provided) ---

    [Fact]
    public void Validate_WithAllFieldsNull_ShouldPass()
    {
        var result = _validator.Validate(EmptyRequest());

        result.IsValid.Should().BeTrue();
    }

    // --- Name ---

    [Fact]
    public void Validate_WithValidName_ShouldPass()
    {
        var request = EmptyRequest();
        request.Name = "Vindskydd Gesebol";

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithEmptyName_ShouldFail()
    {
        var request = EmptyRequest();
        request.Name = string.Empty;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithNullName_ShouldPass()
    {
        var request = EmptyRequest();
        request.Name = null;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    // --- FacilityType ---

    [Fact]
    public void Validate_WithValidFacilityType_ShouldPass()
    {
        var request = EmptyRequest();
        request.FacilityType = 1;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithFacilityTypeZero_ShouldPass()
    {
        // NotEmpty() on int? only rejects null — the When(HasValue) guard already handles that.
        // 0 has a value, so the rule runs but passes since it is not null.
        var request = EmptyRequest();
        request.FacilityType = 0;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithNullFacilityType_ShouldPass()
    {
        var request = EmptyRequest();
        request.FacilityType = null;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    // --- Latitude ---

    [Fact]
    public void Validate_WithLatitudeAtMaxBoundary_ShouldPass()
    {
        var request = EmptyRequest();
        request.Latitude = 90;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithLatitudeExceedingMaxBoundary_ShouldFail()
    {
        var request = EmptyRequest();
        request.Latitude = 90.0001m;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithLatitudeAtMinBoundary_ShouldPass()
    {
        var request = EmptyRequest();
        request.Latitude = -90;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithLatitudeBelowMinBoundary_ShouldFail()
    {
        var request = EmptyRequest();
        request.Latitude = -90.0001m;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithNullLatitude_ShouldPass()
    {
        var request = EmptyRequest();
        request.Latitude = null;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    // --- Longitude ---

    [Fact]
    public void Validate_WithLongitudeAtMaxBoundary_ShouldPass()
    {
        var request = EmptyRequest();
        request.Longitude = 180;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithLongitudeExceedingMaxBoundary_ShouldFail()
    {
        var request = EmptyRequest();
        request.Longitude = 180.0001m;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithLongitudeAtMinBoundary_ShouldPass()
    {
        var request = EmptyRequest();
        request.Longitude = -180;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithLongitudeBelowMinBoundary_ShouldFail()
    {
        var request = EmptyRequest();
        request.Longitude = -180.0001m;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithNullLongitude_ShouldPass()
    {
        var request = EmptyRequest();
        request.Longitude = null;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }
}
