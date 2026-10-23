// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Validators.UserMapping;
using WebDataContracts.RequestModels.UserMapping;

namespace UnitTests.ValidatorTests;

public class SaveUserMappingRequestValidatorTests
{
    private readonly SaveUserMappingRequestValidator _validator = new();

    private static SaveUserMappingRequest Valid() => new()
    {
        KeycloakSubjectId = "staging-sub",
        NickName = "Vandrar",
        Email = "vandrar@example.com",
    };

    [Fact]
    public void Validate_WithValidData_ShouldPass()
    {
        _validator.Validate(Valid()).IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithANicknameOver20Characters_ShouldFail()
    {
        var request = Valid();
        request.NickName = new string('a', 21);

        _validator.Validate(request).IsValid.Should().BeFalse();
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-an-address")]
    public void Validate_WithABadEmail_ShouldFail(string email)
    {
        var request = Valid();
        request.Email = email;

        _validator.Validate(request).IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithoutASubjectId_ShouldFail()
    {
        var request = Valid();
        request.KeycloakSubjectId = "";

        _validator.Validate(request).IsValid.Should().BeFalse();
    }
}
