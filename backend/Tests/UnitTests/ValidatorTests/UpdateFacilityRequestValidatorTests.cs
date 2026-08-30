// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Validators.Facility;
using AwesomeAssertions;
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
    public void Validate_WithFacilityTypeZero_ShouldFail()
    {
        var request = EmptyRequest();
        request.FacilityType = 0;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithNullFacilityType_ShouldPass()
    {
        var request = EmptyRequest();
        request.FacilityType = null;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData(4)]
    [InlineData(12)]
    [InlineData(31)]
    public void Validate_WithCombinedFacilityType_ShouldPass(int facilityType)
    {
        var request = EmptyRequest();
        request.FacilityType = facilityType;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData(32)]
    [InlineData(99)]
    [InlineData(-1)]
    public void Validate_WithUnknownFacilityTypeBits_ShouldFail(int facilityType)
    {
        var request = EmptyRequest();
        request.FacilityType = facilityType;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    // --- Latitude ---

    [Fact]
    public void Validate_WithLatitudeAtMaxBoundary_ShouldPass()
    {
        var request = EmptyRequest();
        request.Latitude = 90;
        request.Longitude = 12.8m;   // coordinates travel as a pair

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
        request.Longitude = 12.8m;   // coordinates travel as a pair

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
        request.Latitude = 57.7m;    // coordinates travel as a pair

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
        request.Latitude = 57.7m;    // coordinates travel as a pair

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

    // --- Coordinates travel as a pair (they are stored as a single Point) ---

    [Fact]
    public void Validate_WithLatitudeButNoLongitude_ShouldFail()
    {
        var request = EmptyRequest();
        request.Latitude = 58.9m;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithLongitudeButNoLatitude_ShouldFail()
    {
        var request = EmptyRequest();
        request.Longitude = 14.5m;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithBothCoordinates_ShouldPass()
    {
        var request = EmptyRequest();
        request.Latitude = 58.9m;
        request.Longitude = 14.5m;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }
}
