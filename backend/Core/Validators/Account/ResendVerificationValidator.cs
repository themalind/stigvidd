// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using FluentValidation;
using WebDataContracts.RequestModels.Account;

namespace Core.Validators.Account;

public class ResendVerificationValidator : AbstractValidator<ResendVerificationRequest>
{
    public ResendVerificationValidator()
    {
        RuleFor(request => request.Email)
            .NotEmpty().WithMessage("Email is required.")
            .EmailAddress().WithMessage("Email must be a valid email address.");
    }
}
