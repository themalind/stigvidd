// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using FluentValidation;
using Infrastructure.Data.Entities;
using WebDataContracts.RequestModels.Friend;

namespace Core.Validators.Friend;

public class SetFriendNoteRequestValidator : AbstractValidator<SetFriendNoteRequest>
{
    public SetFriendNoteRequestValidator()
    {
        RuleFor(x => x.Note)
            .Must(note => note == null || note.Trim().Length <= FriendNote.MaxLength)
                .WithMessage($"Note must not exceed {FriendNote.MaxLength} characters.");
    }
}
