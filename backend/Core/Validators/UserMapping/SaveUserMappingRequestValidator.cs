// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using FluentValidation;
using WebDataContracts.RequestModels.UserMapping;

namespace Core.Validators.UserMapping;

public class SaveUserMappingRequestValidator : AbstractValidator<SaveUserMappingRequest>
{
    public SaveUserMappingRequestValidator()
    {
        RuleFor(r => r.KeycloakSubjectId).NotEmpty().WithMessage("KeycloakSubjectId is required.");
        RuleFor(r => r.Email)
            .NotEmpty().WithMessage("Email is required.")
            .EmailAddress().WithMessage("Invalid email format.");
        RuleFor(r => r.NickName)
            .NotEmpty().WithMessage("NickName is required.")
            .MaximumLength(20).WithMessage("NickName cannot exceed 20 characters.");
    }
}
