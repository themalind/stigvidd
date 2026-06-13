using FluentAssertions;
using WebDataContracts.RequestModels.Trail;

namespace UnitTests.ValidatorTests;

public class UpdateTrailRequestValidatorTests
{
    private readonly UpdateTrailRequestValidator _validator = new();

    private static UpdateTrailRequest ValidRequest() => new()
    {
        Name = "Sörknatten",
        TrailLength = 5.0m,
    };

    // --- Name ---

    [Fact]
    public void Validate_WithValidName_ShouldPass()
    {
        var request = ValidRequest();

        var result = _validator.Validate(request);

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

    // --- TrailLength ---

    [Fact]
    public void Validate_WithTrailLengthGreaterThanZero_ShouldPass()
    {
        var request = ValidRequest();
        request.TrailLength = 0.1m;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithTrailLengthZero_ShouldFail()
    {
        var request = ValidRequest();
        request.TrailLength = 0;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithNegativeTrailLength_ShouldFail()
    {
        var request = ValidRequest();
        request.TrailLength = -1m;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    // --- Classification ---

    [Fact]
    public void Validate_WithNullClassification_ShouldPass()
    {
        var request = ValidRequest();
        request.Classification = null;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithClassificationAtMinBoundary_ShouldPass()
    {
        var request = ValidRequest();
        request.Classification = 1;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithClassificationAtMaxBoundary_ShouldPass()
    {
        var request = ValidRequest();
        request.Classification = 5;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithClassificationBelowMinBoundary_ShouldFail()
    {
        var request = ValidRequest();
        request.Classification = 0;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithClassificationAboveMaxBoundary_ShouldFail()
    {
        var request = ValidRequest();
        request.Classification = 6;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    // --- AccessibilityInfo ---

    [Fact]
    public void Validate_WithNullAccessibilityInfo_ShouldPass()
    {
        var request = ValidRequest();
        request.AccessibilityInfo = null;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithValidAccessibilityInfo_ShouldPass()
    {
        var request = ValidRequest();
        request.AccessibilityInfo = "Rullstolsvänlig";

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithEmptyAccessibilityInfo_ShouldFail()
    {
        var request = ValidRequest();
        request.AccessibilityInfo = string.Empty;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithAccessibilityInfoExceedingMaxLength_ShouldFail()
    {
        var request = ValidRequest();
        request.AccessibilityInfo = new string('a', 201);

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    // --- TrailSymbol ---

    [Fact]
    public void Validate_WithNullTrailSymbol_ShouldPass()
    {
        var request = ValidRequest();
        request.TrailSymbol = null;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithValidTrailSymbol_ShouldPass()
    {
        var request = ValidRequest();
        request.TrailSymbol = "Blå triangel";

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithEmptyTrailSymbol_ShouldFail()
    {
        var request = ValidRequest();
        request.TrailSymbol = string.Empty;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithTrailSymbolExceedingMaxLength_ShouldFail()
    {
        var request = ValidRequest();
        request.TrailSymbol = new string('a', 61);

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
        request.Description = "En vacker led genom skogen.";

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

    // --- FullDescription ---

    [Fact]
    public void Validate_WithNullFullDescription_ShouldPass()
    {
        var request = ValidRequest();
        request.FullDescription = null;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithFullDescriptionAtMinLength_ShouldPass()
    {
        var request = ValidRequest();
        request.FullDescription = new string('a', 1000);

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithEmptyFullDescription_ShouldFail()
    {
        var request = ValidRequest();
        request.FullDescription = string.Empty;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithFullDescriptionBelowMinLength_ShouldFail()
    {
        var request = ValidRequest();
        request.FullDescription = new string('a', 999);

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    // --- Tags ---

    [Fact]
    public void Validate_WithNullTags_ShouldPass()
    {
        var request = ValidRequest();
        request.Tags = null;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithValidTags_ShouldPass()
    {
        var request = ValidRequest();
        request.Tags = "skog,natur";

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithEmptyTags_ShouldFail()
    {
        var request = ValidRequest();
        request.Tags = string.Empty;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    // --- City ---

    [Fact]
    public void Validate_WithNullCity_ShouldPass()
    {
        var request = ValidRequest();
        request.City = null;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithValidCity_ShouldPass()
    {
        var request = ValidRequest();
        request.City = "Karlstad";

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithEmptyCity_ShouldFail()
    {
        var request = ValidRequest();
        request.City = string.Empty;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithCityExceedingMaxLength_ShouldFail()
    {
        var request = ValidRequest();
        request.City = new string('a', 101);

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    // --- VisitorInformation ---

    [Fact]
    public void Validate_WithNullVisitorInformation_ShouldPass()
    {
        var request = ValidRequest();
        request.VisitorInformation = null;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithValidVisitorInformation_ShouldPass()
    {
        var request = ValidRequest();
        request.VisitorInformation = new UpdateVisitorInformationRequest
        {
            GettingThere = "Ta E18 mot Karlstad.",
            Parking = "Stor parkering vid entrén.",
        };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithInvalidVisitorInformation_ShouldFail()
    {
        var request = ValidRequest();
        request.VisitorInformation = new UpdateVisitorInformationRequest
        {
            GettingThere = string.Empty,
        };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }
}
