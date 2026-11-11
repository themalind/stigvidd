// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using FluentValidation;
using WebDataContracts.RequestModels.User;

namespace Core.Validators.Friends;

public class CheckUsernameRequestValidator : AbstractValidator<CheckUsernameRequest>
{
    public CheckUsernameRequestValidator()
    {
        RuleFor(u => u.Username)
            .NotEmpty()
            .MaximumLength(20);
    }
}
