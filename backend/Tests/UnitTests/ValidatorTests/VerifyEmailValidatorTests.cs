// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Validators.Account;
using WebDataContracts.RequestModels.Account;

namespace UnitTests.ValidatorTests;

public class VerifyEmailValidatorTests
{
    private readonly VerifyEmailValidator _validator = new();

    private static VerifyEmailRequest Request(string email = "vandrare@example.local", string code = "123456") =>
        new() { Email = email, Code = code };

    [Fact]
    public void Validate_WithAnAddressAndSixDigits_Passes()
    {
        _validator.Validate(Request()).IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("")]
    [InlineData("12345")]
    [InlineData("1234567")]
    [InlineData("12345a")]
    [InlineData("12 345")]
    public void Validate_WhenTheCodeIsNotSixDigits_Fails(string code)
    {
        _validator.Validate(Request(code: code)).IsValid.Should().BeFalse();
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-an-email")]
    public void Validate_WhenTheEmailIsMissingOrMalformed_Fails(string email)
    {
        _validator.Validate(Request(email: email)).IsValid.Should().BeFalse();
    }
}
