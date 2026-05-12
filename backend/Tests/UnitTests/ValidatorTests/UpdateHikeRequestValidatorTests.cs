using Core.Validators;
using FluentAssertions;
using WebDataContracts.RequestModels.Hike;

namespace UnitTests.ValidatorTests;

public class UpdateHikeRequestValidatorTests
{
    private readonly UpdateHikeRequestValidator _validator = new();

    [Fact]
    public void Validate_WithAllFieldsNull_ShouldPass()
    {
        var request = new UpdateHikeRequest();

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithAllValidFields_ShouldPass()
    {
        var request = new UpdateHikeRequest
        {
            Name = "Updated hike name",
            Description = "A nice hike through the forest.",
            GettingThere = "Take the train to station X.",
            ParkingInfo = "Parking available at trailhead."
        };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithEmptyName_ShouldFail()
    {
        var request = new UpdateHikeRequest { Name = string.Empty };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithNameNull_ShouldPass()
    {
        var request = new UpdateHikeRequest { Name = null, Description = "Valid description." };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithNameAt60Characters_ShouldPass()
    {
        var request = new UpdateHikeRequest { Name = new string('a', 60) };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithNameExceeding60Characters_ShouldFail()
    {
        var request = new UpdateHikeRequest { Name = new string('a', 61) };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithEmptyDescription_ShouldFail()
    {
        var request = new UpdateHikeRequest { Description = string.Empty };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithDescriptionNull_ShouldPass()
    {
        var request = new UpdateHikeRequest { Name = "ValidName", Description = null };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithDescriptionAt500Characters_ShouldPass()
    {
        var request = new UpdateHikeRequest { Description = new string('a', 500) };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithDescriptionExceeding500Characters_ShouldFail()
    {
        var request = new UpdateHikeRequest { Description = new string('a', 501) };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithEmptyGettingThere_ShouldFail()
    {
        var request = new UpdateHikeRequest { GettingThere = string.Empty };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithGettingThereNull_ShouldPass()
    {
        var request = new UpdateHikeRequest { GettingThere = null };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithGettingThereAt200Characters_ShouldPass()
    {
        var request = new UpdateHikeRequest { GettingThere = new string('a', 200) };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithGettingThereExceeding200Characters_ShouldFail()
    {
        var request = new UpdateHikeRequest { GettingThere = new string('a', 201) };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithEmptyParkingInfo_ShouldFail()
    {
        var request = new UpdateHikeRequest { ParkingInfo = string.Empty };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithParkingInfoNull_ShouldPass()
    {
        var request = new UpdateHikeRequest { ParkingInfo = null };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithParkingInfoAt200Characters_ShouldPass()
    {
        var request = new UpdateHikeRequest { ParkingInfo = new string('a', 200) };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithParkingInfoExceeding200Characters_ShouldFail()
    {
        var request = new UpdateHikeRequest { ParkingInfo = new string('a', 201) };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }
}
