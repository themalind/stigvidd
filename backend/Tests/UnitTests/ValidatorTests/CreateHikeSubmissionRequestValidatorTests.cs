// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Validators.HikeSubmission;
using WebDataContracts.RequestModels.HikeSubmission;

namespace UnitTests.ValidatorTests;

public class CreateHikeSubmissionRequestValidatorTests
{
    private readonly CreateHikeSubmissionRequestValidator _validator = new();

    private static CreateHikeSubmissionRequest ValidRequest() => new()
    {
        HikeIdentifier = "hike-1",
        Name = "Kvällsrunda",
        Description = "Runt sjön",
        Classification = 2,
        GettingThere = "Buss 3",
        City = "Borås",
        AcceptTransfer = true,
        ConsentVersion = HikeSubmissionConsent.CurrentVersion,
        ConsentLocale = "sv",
    };

    [Fact]
    public void Validate_WithTheCurrentConsent_ShouldPass()
    {
        _validator.Validate(ValidRequest()).IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData(200, true)]
    [InlineData(201, false)]
    public void Validate_AccessibilityInfo_AllowsWhatATrailCanHold(int length, bool valid)
    {
        var request = ValidRequest();
        request.AccessibilityInfo = new string('a', length);

        _validator.Validate(request).IsValid.Should().Be(valid);
    }

    [Theory]
    [InlineData("", false)]
    [InlineData("   ", false)]
    [InlineData("Borås", true)]
    [InlineData("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", true)]
    [InlineData("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", false)]
    public void Validate_City_IsRequiredAndFitsATrail(string city, bool valid)
    {
        var request = ValidRequest();
        request.City = city;

        _validator.Validate(request).IsValid.Should().Be(valid);
    }

    [Fact]
    public void Validate_WithoutAcceptTransfer_ShouldFail()
    {
        var request = ValidRequest();
        request.AcceptTransfer = false;

        _validator.Validate(request).IsValid.Should().BeFalse();
    }

    [Theory]
    [InlineData("")]
    [InlineData("2026-01-01")]
    public void Validate_WithAnOutdatedConsentVersion_ShouldFail(string version)
    {
        var request = ValidRequest();
        request.ConsentVersion = version;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().ContainSingle(e => e.PropertyName == nameof(CreateHikeSubmissionRequest.ConsentVersion));
    }

    [Fact]
    public void Validate_WithoutAConsentLocale_ShouldFail()
    {
        var request = ValidRequest();
        request.ConsentLocale = string.Empty;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().ContainSingle(e => e.PropertyName == nameof(CreateHikeSubmissionRequest.ConsentLocale));
    }
}
