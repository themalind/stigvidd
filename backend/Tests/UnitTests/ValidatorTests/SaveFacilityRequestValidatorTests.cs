// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Validators.Trails;
using WebDataContracts.RequestModels.Facility;

namespace UnitTests.ValidatorTests;

public class SaveFacilityRequestValidatorTests
{
    private readonly SaveFacilityRequestValidator _validator = new();

    private static SaveFacilityRequest Valid(
        string name = "Vindskydd Gesebol",
        int facilityType = 2,
        decimal? latitude = 57.7m,
        decimal? longitude = 12.9m,
        string location = "",
        string description = "",
        string url = "")
    {
        return new SaveFacilityRequest
        {
            Name = name,
            FacilityType = facilityType,
            IsAccessible = false,
            Latitude = latitude,
            Longitude = longitude,
            Location = location,
            Description = description,
            Url = url,
        };
    }

    [Fact]
    public void Validate_WithAFullRequest_Passes()
    {
        var result = _validator.Validate(Valid(location: "Vid sjön", description: "Två vindskydd.", url: "https://www.boras.se"));

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithNoCoordinatesAtAll_Passes()
    {
        var result = _validator.Validate(Valid(latitude: null, longitude: null));

        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Validate_WithABlankName_Fails(string name)
    {
        var result = _validator.Validate(Valid(name: name));

        result.Errors.Should().ContainSingle(e => e.PropertyName == nameof(SaveFacilityRequest.Name));
    }

    [Fact]
    public void Validate_WithANameOverTheLimit_Fails()
    {
        var result = _validator.Validate(Valid(name: new string('a', SaveFacilityRequestValidator.NameMaxLength + 1)));

        result.Errors.Should().ContainSingle(e => e.PropertyName == nameof(SaveFacilityRequest.Name));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(64)]
    public void Validate_WithAnUnknownOrMissingType_Fails(int facilityType)
    {
        var result = _validator.Validate(Valid(facilityType: facilityType));

        result.Errors.Should().Contain(e => e.PropertyName == nameof(SaveFacilityRequest.FacilityType));
    }

    [Theory]
    [InlineData(90.1, 12.9)]
    [InlineData(-90.1, 12.9)]
    [InlineData(57.7, 180.1)]
    [InlineData(57.7, -180.1)]
    public void Validate_WithCoordinatesOutOfRange_Fails(double latitude, double longitude)
    {
        var result = _validator.Validate(Valid(latitude: (decimal)latitude, longitude: (decimal)longitude));

        result.IsValid.Should().BeFalse();
    }

    [Theory]
    [InlineData(57.7, null)]
    [InlineData(null, 12.9)]
    public void Validate_WithHalfACoordinatePair_Fails(double? latitude, double? longitude)
    {
        var result = _validator.Validate(Valid(latitude: (decimal?)latitude, longitude: (decimal?)longitude));

        result.Errors.Should().ContainSingle(e => e.ErrorMessage == "Latitude and longitude must be supplied together.");
    }

    [Fact]
    public void Validate_WithADescriptionAtTheLimit_Passes()
    {
        var result = _validator.Validate(Valid(description: new string('a', SaveFacilityRequestValidator.DescriptionMaxLength)));

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithADescriptionOverTheLimit_Fails()
    {
        var result = _validator.Validate(Valid(description: new string('a', SaveFacilityRequestValidator.DescriptionMaxLength + 1)));

        result.Errors.Should().ContainSingle(e => e.PropertyName == nameof(SaveFacilityRequest.Description));
    }

    [Fact]
    public void Validate_WithALocationOverTheLimit_Fails()
    {
        var result = _validator.Validate(Valid(location: new string('a', SaveFacilityRequestValidator.LocationMaxLength + 1)));

        result.Errors.Should().ContainSingle(e => e.PropertyName == nameof(SaveFacilityRequest.Location));
    }

    [Theory]
    [InlineData("https://www.boras.se/gesebol")]
    [InlineData("http://example.org")]
    [InlineData("")]
    public void Validate_WithAnEmptyOrHttpUrl_Passes(string url)
    {
        var result = _validator.Validate(Valid(url: url));

        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("boras.se")]
    [InlineData("ftp://boras.se")]
    [InlineData("javascript:alert(1)")]
    public void Validate_WithAUrlThatIsNotAnHttpAddress_Fails(string url)
    {
        var result = _validator.Validate(Valid(url: url));

        result.Errors.Should().ContainSingle(e => e.PropertyName == nameof(SaveFacilityRequest.Url));
    }
}
