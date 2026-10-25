// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using FluentValidation;
using WebDataContracts.RequestModels.User;

namespace Core.Validators.User;

public class CreateUserRequestValidator : AbstractValidator<CreateUserRequest>
{
    public CreateUserRequestValidator()
    {
        RuleFor(CreateUserRequest => CreateUserRequest.Email)
            .NotEmpty().WithMessage("Email is required.")
            .EmailAddress().WithMessage("Invalid email format.");
        RuleFor(CreateUserRequest => CreateUserRequest.NickName)
            .NotEmpty().WithMessage("NickName is required.")
            .MinimumLength(2).WithMessage("NickName must be at least 2 characters.")
            .MaximumLength(20).WithMessage("NickName cannot exceed 20 characters.");
    }
}
