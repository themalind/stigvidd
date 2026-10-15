// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Validators.HikeShare;
using AwesomeAssertions;
using System.Text.Json;
using WebDataContracts.RequestModels.HikeShare;

namespace UnitTests.ValidatorTests;

public class HikeShareReshareValidatorTests
{
    private readonly HikeShareReshareValidator _validator = new();

    private static ReshareSharedHikeRequest ValidRequest() => new()
    {
        HikeIdentifier = "3f9c1b7e-8a42-4e6d-9c5f-2a7b1d8e4f90",
        ReShareToNames = ["VandrarVennen"]
    };

    [Fact]
    public void Validate_WithValidData_ShouldPass()
    {
        var result = _validator.Validate(ValidRequest());
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithEmptyHikeIdentifier_ShouldFail()
    {
        var request = ValidRequest();
        request.HikeIdentifier = string.Empty;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithHikeIdentifierTooShort_ShouldFail()
    {
        var request = ValidRequest();
        request.HikeIdentifier = "too-short";

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithHikeIdentifierTooLong_ShouldFail()
    {
        var request = ValidRequest();
        request.HikeIdentifier = new string('a', 37);

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithHikeIdentifierExactly36Characters_ShouldPass()
    {
        var request = ValidRequest();
        request.HikeIdentifier = new string('a', 36);

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithNullRecipients_ShouldFailWithoutThrowing()
    {
        var request = JsonSerializer.Deserialize<ReshareSharedHikeRequest>(
            """{"hikeIdentifier":"3f9c1b7e-8a42-4e6d-9c5f-2a7b1d8e4f90","reShareToNames":null}""",
            JsonSerializerOptions.Web);
        request.Should().NotBeNull();

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithNoRecipients_ShouldFail()
    {
        var request = ValidRequest();
        request.ReShareToNames = [];

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithAnEmptyNameAmongTheRecipients_ShouldFail()
    {
        var request = ValidRequest();
        request.ReShareToNames = ["NaturElskaren", string.Empty];

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithNameAt20Characters_ShouldPass()
    {
        var request = ValidRequest();
        request.ReShareToNames = [new string('a', 20)];

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithNameExceeding20Characters_ShouldFail()
    {
        var request = ValidRequest();
        request.ReShareToNames = ["NaturElskaren", new string('a', 21)];

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithTheMaximumNumberOfRecipients_ShouldPass()
    {
        var request = ValidRequest();
        request.ReShareToNames = Enumerable.Range(0, RecipientRules.MaxRecipients).Select(i => $"user{i}").ToList();

        var result = _validator.Validate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithOneRecipientTooMany_ShouldFail()
    {
        var request = ValidRequest();
        request.ReShareToNames = Enumerable.Range(0, RecipientRules.MaxRecipients + 1).Select(i => $"user{i}").ToList();

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
    }
}
