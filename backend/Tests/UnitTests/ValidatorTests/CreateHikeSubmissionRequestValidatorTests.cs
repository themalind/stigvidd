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
        AcceptTransfer = true,
        ConsentVersion = HikeSubmissionConsent.CurrentVersion,
        ConsentLocale = "sv",
    };

    [Fact]
    public void Validate_WithTheCurrentConsent_ShouldPass()
    {
        _validator.Validate(ValidRequest()).IsValid.Should().BeTrue();
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
