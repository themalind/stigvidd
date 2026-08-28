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
    public void Validate_WithUnclassifiedZero_ShouldPass()
    {
        var request = ValidRequest();
        request.Classification = 0;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
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
    public void Validate_WithEmptyAccessibilityInfo_ShouldPass()
    {
        var request = ValidRequest();
        request.AccessibilityInfo = string.Empty;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
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
    public void Validate_WithEmptyTrailSymbol_ShouldPass()
    {
        var request = ValidRequest();
        request.TrailSymbol = string.Empty;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithTrailSymbolExceedingMaxLength_ShouldFail()
    {
        var request = ValidRequest();
        request.TrailSymbol = new string('a', 41);

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
    public void Validate_WithEmptyDescription_ShouldPass()
    {
        var request = ValidRequest();
        request.Description = string.Empty;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithDescriptionExceedingMaxLength_ShouldFail()
    {
        var request = ValidRequest();
        request.Description = new string('a', 801);

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
    public void Validate_WithFullDescriptionAtMaxLength_ShouldPass()
    {
        var request = ValidRequest();
        request.FullDescription = new string('a', 2000);

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithEmptyFullDescription_ShouldPass()
    {
        var request = ValidRequest();
        request.FullDescription = string.Empty;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithFullDescriptionExceedingMaxLength_ShouldFail()
    {
        var request = ValidRequest();
        request.FullDescription = new string('a', 2001);

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
    public void Validate_WithEmptyTags_ShouldPass()
    {
        var request = ValidRequest();
        request.Tags = string.Empty;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
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
    public void Validate_WithEmptyCity_ShouldPass()
    {
        var request = ValidRequest();
        request.City = string.Empty;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithCityExceedingMaxLength_ShouldFail()
    {
        var request = ValidRequest();
        request.City = new string('a', 31);

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
            GettingThere = new string('a', 401),
        };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithNegativeClassification_ShouldFail()
    {
        var request = ValidRequest();
        request.Classification = -1;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithAccessibilityInfoAtMaxLength_ShouldPass()
    {
        var request = ValidRequest();
        request.AccessibilityInfo = new string('a', 200);

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    // The web trail editor round-trips every field from GET, and the entity
    // stores "" for anything unset, so the fields an operator leaves alone
    // arrive as empty strings and Classification 0.
    [Fact]
    public void Validate_WithTrailEditorRoundTripPayload_ShouldPass()
    {
        var request = new UpdateTrailRequest
        {
            Name = "SÃ¶rknatten",
            TrailLength = 5.0m,
            Classification = 0,
            Accessibility = false,
            AccessibilityInfo = "RullstolsvÃ¤nlig hela vÃ¤gen.",
            TrailSymbol = string.Empty,
            Description = "En vacker led genom skogen.",
            FullDescription = string.Empty,
            Tags = string.Empty,
            City = string.Empty,
            VisitorInformation = new UpdateVisitorInformationRequest
            {
                GettingThere = "Ta E18 mot Karlstad.",
                PublicTransport = string.Empty,
                Parking = string.Empty,
                Illumination = false,
                IlluminationText = string.Empty,
                MaintainedBy = string.Empty,
                WinterMaintenance = false,
            },
        };

        var result = _validator.Validate(request);

        result.Errors.Select(e => e.PropertyName).Should().BeEmpty();
    }

    // The longest value each column actually holds, measured against the test
    // database 2026-08-28. A limit set under one of these makes that trail
    // impossible to update at all.
    [Fact]
    public void Validate_WithLongestValuesInTheDatabase_ShouldPass()
    {
        var request = ValidRequest();
        request.AccessibilityInfo = new string('a', 139);
        request.TrailSymbol = new string('a', 31);
        request.Description = new string('a', 622);
        request.FullDescription = new string('a', 1208);
        request.City = new string('a', 10);
        request.VisitorInformation = new UpdateVisitorInformationRequest
        {
            GettingThere = new string('a', 248),
            PublicTransport = new string('a', 287),
            Parking = new string('a', 200),
            IlluminationText = new string('a', 139),
            MaintainedBy = new string('a', 10),
        };

        var result = _validator.Validate(request);

        result.Errors.Select(e => e.PropertyName).Should().BeEmpty();
    }
}
