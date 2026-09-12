// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Validators.Account;
using WebDataContracts.RequestModels.Account;

namespace UnitTests.ValidatorTests;

public class ResendVerificationValidatorTests
{
    private readonly ResendVerificationValidator _validator = new();

    [Fact]
    public void Validate_WithAnAddress_Passes()
    {
        _validator.Validate(new ResendVerificationRequest { Email = "vandrare@example.local" })
            .IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-an-email")]
    public void Validate_WhenTheEmailIsMissingOrMalformed_Fails(string email)
    {
        _validator.Validate(new ResendVerificationRequest { Email = email }).IsValid.Should().BeFalse();
    }
}
