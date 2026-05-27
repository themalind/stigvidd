using FluentAssertions;
using WebDataContracts.RequestModels.Trail;

namespace UnitTests.ValidatorTests;

public class UpdateVisitorInformationRequestValidatorTests
{
    private readonly UpdateVisitorInformationRequestValidator _validator = new();

    private static UpdateVisitorInformationRequest EmptyRequest() => new();

    // --- All null (no fields provided) ---

    [Fact]
    public void Validate_WithAllFieldsNull_ShouldPass()
    {
        var result = _validator.Validate(EmptyRequest());

        result.IsValid.Should().BeTrue();
    }

    // --- GettingThere ---

    [Fact]
    public void Validate_WithNullGettingThere_ShouldPass()
    {
        var request = EmptyRequest();
        request.GettingThere = null;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithValidGettingThere_ShouldPass()
    {
        var request = EmptyRequest();
        request.GettingThere = "Ta E18 mot Karlstad och sväng av vid skylten.";

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithEmptyGettingThere_ShouldFail()
    {
        var request = EmptyRequest();
        request.GettingThere = string.Empty;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithGettingThereExceedingMaxLength_ShouldFail()
    {
        var request = EmptyRequest();
        request.GettingThere = new string('a', 201);

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    // --- PublicTransport ---

    [Fact]
    public void Validate_WithNullPublicTransport_ShouldPass()
    {
        var request = EmptyRequest();
        request.PublicTransport = null;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithValidPublicTransport_ShouldPass()
    {
        var request = EmptyRequest();
        request.PublicTransport = "Buss 500 stannar 200 m från entrén.";

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithEmptyPublicTransport_ShouldFail()
    {
        var request = EmptyRequest();
        request.PublicTransport = string.Empty;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithPublicTransportExceedingMaxLength_ShouldFail()
    {
        var request = EmptyRequest();
        request.PublicTransport = new string('a', 201);

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    // --- Parking ---

    [Fact]
    public void Validate_WithNullParking_ShouldPass()
    {
        var request = EmptyRequest();
        request.Parking = null;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithValidParking_ShouldPass()
    {
        var request = EmptyRequest();
        request.Parking = "Stor grusparkering vid entrén, gratis.";

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithEmptyParking_ShouldFail()
    {
        var request = EmptyRequest();
        request.Parking = string.Empty;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithParkingExceedingMaxLength_ShouldFail()
    {
        var request = EmptyRequest();
        request.Parking = new string('a', 201);

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    // --- IlluminationText ---

    [Fact]
    public void Validate_WithNullIlluminationText_ShouldPass()
    {
        var request = EmptyRequest();
        request.IlluminationText = null;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithValidIlluminationText_ShouldPass()
    {
        var request = EmptyRequest();
        request.IlluminationText = "Leden är belyst oktober–april.";

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithEmptyIlluminationText_ShouldFail()
    {
        var request = EmptyRequest();
        request.IlluminationText = string.Empty;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithIlluminationTextExceedingMaxLength_ShouldFail()
    {
        var request = EmptyRequest();
        request.IlluminationText = new string('a', 201);

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    // --- MaintainedBy ---

    [Fact]
    public void Validate_WithNullMaintainedBy_ShouldPass()
    {
        var request = EmptyRequest();
        request.MaintainedBy = null;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithValidMaintainedBy_ShouldPass()
    {
        var request = EmptyRequest();
        request.MaintainedBy = "Karlstads kommun";

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithEmptyMaintainedBy_ShouldFail()
    {
        var request = EmptyRequest();
        request.MaintainedBy = string.Empty;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithMaintainedByExceedingMaxLength_ShouldFail()
    {
        var request = EmptyRequest();
        request.MaintainedBy = new string('a', 101);

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }
}
