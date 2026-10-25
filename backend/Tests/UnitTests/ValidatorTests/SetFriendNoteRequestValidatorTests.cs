// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Validators.Friend;
using WebDataContracts.RequestModels.Friend;

namespace UnitTests.ValidatorTests;

public class SetFriendNoteRequestValidatorTests
{
    private readonly SetFriendNoteRequestValidator _validator = new();

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("Emil på jobbet")]
    public void Validate_NullBlankOrShort_Passes(string? note)
    {
        _validator.Validate(new SetFriendNoteRequest { Note = note }).IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_SixtyCharacters_Passes()
    {
        _validator.Validate(new SetFriendNoteRequest { Note = new string('a', 60) }).IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_SixtyOneCharacters_Fails()
    {
        _validator.Validate(new SetFriendNoteRequest { Note = new string('a', 61) }).IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_SurroundingSpacesDoNotCount()
    {
        _validator.Validate(new SetFriendNoteRequest { Note = $"  {new string('a', 60)}  " }).IsValid.Should().BeTrue();
    }
}
