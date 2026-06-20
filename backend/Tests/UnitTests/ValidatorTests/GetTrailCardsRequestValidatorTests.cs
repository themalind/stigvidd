using Core.Validators.Trail;
using FluentAssertions;
using WebDataContracts.RequestModels.Trail;

namespace UnitTests.ValidatorTests;

public class GetTrailCardsRequestValidatorTests
{
    private const int MaxIdentifiers = 50;

    private readonly GetTrailCardsRequestValidator _validator = new();

    private static GetTrailCardsRequest ValidRequest() => new()
    {
        Identifiers = ["trail-1", "trail-2"]
    };

    [Fact]
    public void Validate_WithValidData_ShouldPass()
    {
        var result = _validator.Validate(ValidRequest());
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithSingleIdentifier_ShouldPass()
    {
        var request = new GetTrailCardsRequest { Identifiers = ["trail-1"] };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithEmptyCollection_ShouldFail()
    {
        var request = new GetTrailCardsRequest { Identifiers = [] };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithNullCollection_ShouldFail()
    {
        var request = new GetTrailCardsRequest { Identifiers = null! };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithMaxIdentifiers_ShouldPass()
    {
        var request = new GetTrailCardsRequest
        {
            Identifiers = Enumerable.Range(0, MaxIdentifiers).Select(i => $"trail-{i}").ToList()
        };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithMoreThanMaxIdentifiers_ShouldFail()
    {
        var request = new GetTrailCardsRequest
        {
            Identifiers = Enumerable.Range(0, MaxIdentifiers + 1).Select(i => $"trail-{i}").ToList()
        };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithEmptyIdentifierInCollection_ShouldFail()
    {
        var request = new GetTrailCardsRequest { Identifiers = ["trail-1", string.Empty] };

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }
}
