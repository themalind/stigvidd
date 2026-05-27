using Core.Validators.TrailObstacle;
using FluentAssertions;
using WebDataContracts.RequestModels.TrailObstacle;

namespace UnitTests.ValidatorTests;

public class TrailObstacleUpdateRequestValidatorTests
{
    private readonly TrailObstacleUpdateRequestValidator _validator = new();

    [Fact]
    public void Validate_WithAllFieldsNull_ShouldPass()
    {
        var request = new TrailObstacleUpdateRequest { Description = null, IssueType = null };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithValidDescription_ShouldPass()
    {
        var request = new TrailObstacleUpdateRequest { Description = "Stort träd blockerar stigen." };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithDescriptionNull_ShouldPass()
    {
        var request = new TrailObstacleUpdateRequest { Description = null, IssueType = "FallenTree" };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithEmptyDescription_ShouldFail()
    {
        var request = new TrailObstacleUpdateRequest { Description = string.Empty };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithDescriptionTooShort_ShouldFail()
    {
        var request = new TrailObstacleUpdateRequest { Description = "För kort" };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithDescriptionExactly15Characters_ShouldPass()
    {
        var request = new TrailObstacleUpdateRequest { Description = new string('a', 15) };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithDescriptionExceeding500Characters_ShouldFail()
    {
        var request = new TrailObstacleUpdateRequest { Description = new string('a', 501) };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithDescriptionAt500Characters_ShouldPass()
    {
        var request = new TrailObstacleUpdateRequest { Description = new string('a', 500) };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithValidIssueType_ShouldPass()
    {
        var request = new TrailObstacleUpdateRequest { IssueType = "FallenTree" };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithIssueTypeNull_ShouldPass()
    {
        var request = new TrailObstacleUpdateRequest { Description = "Stort träd blockerar stigen.", IssueType = null };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithEmptyIssueType_ShouldFail()
    {
        var request = new TrailObstacleUpdateRequest { IssueType = string.Empty };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }
}
