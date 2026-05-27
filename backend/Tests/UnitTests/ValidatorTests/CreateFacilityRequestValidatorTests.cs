using Core.Validators.Facility;
using FluentAssertions;
using WebDataContracts.RequestModels.Facility;

namespace UnitTests.ValidatorTests;

public class CreateFacilityRequestValidatorTests
{
    private readonly CreateFacilityRequestValidator _validator = new();

    [Fact]
    public void Validate_WithValidData_ShouldPass()
    {
        var result = _validator.Validate(new CreateFacilityRequest
        {
            Name = "Grillplats Tiveden",
            FacilityType = 1,
            IsAccessible = true,
            Latitude = 58.9,
            Longitude = 14.5
        });

        result.IsValid.Should().BeTrue();
    }

    // --- Name ---

    [Fact]
    public void Validate_WithEmptyName_ShouldFail()
    {
        var result = _validator.Validate(new CreateFacilityRequest
        {
            Name = string.Empty,
            FacilityType = 1,
            IsAccessible = true,
            Latitude = 58.9,
            Longitude = 14.5
        });

        result.IsValid.Should().BeFalse();
    }

    // --- FacilityType ---

    [Fact]
    public void Validate_WithFacilityTypeZero_ShouldFail()
    {
        var result = _validator.Validate(new CreateFacilityRequest
        {
            Name = "Grillplats",
            FacilityType = 0,
            IsAccessible = true,
            Latitude = 58.9,
            Longitude = 14.5
        });

        result.IsValid.Should().BeFalse();
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    public void Validate_WithValidFacilityType_ShouldPass(int facilityType)
    {
        var result = _validator.Validate(new CreateFacilityRequest
        {
            Name = "Grillplats",
            FacilityType = facilityType,
            IsAccessible = true,
            Latitude = 58.9,
            Longitude = 14.5
        });

        result.IsValid.Should().BeTrue();
    }

    // --- Latitude ---

    [Fact]
    public void Validate_WithLatitudeAtMaxBoundary_ShouldPass()
    {
        var result = _validator.Validate(new CreateFacilityRequest
        {
            Name = "Grillplats",
            FacilityType = 1,
            IsAccessible = true,
            Latitude = 90,
            Longitude = 14.5
        });

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithLatitudeExceedingMaxBoundary_ShouldFail()
    {
        var result = _validator.Validate(new CreateFacilityRequest
        {
            Name = "Grillplats",
            FacilityType = 1,
            IsAccessible = true,
            Latitude = 90.0001,
            Longitude = 14.5
        });

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithLatitudeAtMinBoundary_ShouldPass()
    {
        var result = _validator.Validate(new CreateFacilityRequest
        {
            Name = "Grillplats",
            FacilityType = 1,
            IsAccessible = true,
            Latitude = -90,
            Longitude = 14.5
        });

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithLatitudeBelowMinBoundary_ShouldFail()
    {
        var result = _validator.Validate(new CreateFacilityRequest
        {
            Name = "Grillplats",
            FacilityType = 1,
            IsAccessible = true,
            Latitude = -90.0001,
            Longitude = 14.5
        });

        result.IsValid.Should().BeFalse();
    }

    // --- Longitude ---

    [Fact]
    public void Validate_WithLongitudeAtMaxBoundary_ShouldPass()
    {
        var result = _validator.Validate(new CreateFacilityRequest
        {
            Name = "Grillplats",
            FacilityType = 1,
            IsAccessible = true,
            Latitude = 58.9,
            Longitude = 180
        });

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithLongitudeExceedingMaxBoundary_ShouldFail()
    {
        var result = _validator.Validate(new CreateFacilityRequest
        {
            Name = "Grillplats",
            FacilityType = 1,
            IsAccessible = true,
            Latitude = 58.9,
            Longitude = 180.0001
        });

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithLongitudeAtMinBoundary_ShouldPass()
    {
        var result = _validator.Validate(new CreateFacilityRequest
        {
            Name = "Grillplats",
            FacilityType = 1,
            IsAccessible = true,
            Latitude = 58.9,
            Longitude = -180
        });

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithLongitudeBelowMinBoundary_ShouldFail()
    {
        var result = _validator.Validate(new CreateFacilityRequest
        {
            Name = "Grillplats",
            FacilityType = 1,
            IsAccessible = true,
            Latitude = 58.9,
            Longitude = -180.0001
        });

        result.IsValid.Should().BeFalse();
    }
}
