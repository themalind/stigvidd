// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Services;
using Core.Validators.Municipalities;
using WebDataContracts.RequestModels.Municipality;

namespace UnitTests.ValidatorTests;

public class CreateMunicipalityRequestValidatorTests
{
    private readonly CreateMunicipalityRequestValidator _validator = new();

    [Fact]
    public void Validate_WithAName_Passes()
    {
        var result = _validator.Validate(new CreateMunicipalityRequest { Name = "Borås" });

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithoutLettersOrDigits_SaysSo()
    {
        var result = _validator.Validate(new CreateMunicipalityRequest { Name = "--" });

        result.Errors.Should().ContainSingle().Which.ErrorMessage.Should().Be(Slug.FitsMessage);
    }

    [Fact]
    public void Validate_WithTooLongASlug_SaysSo()
    {
        var result = _validator.Validate(new CreateMunicipalityRequest { Name = new string('a', Slug.MaxLength + 1) });

        result.Errors.Should().ContainSingle().Which.ErrorMessage.Should().Be(Slug.FitsMessage);
    }
}
