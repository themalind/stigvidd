// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using FluentValidation;
using WebDataContracts.RequestModels.Media;

namespace Core.Validators.Media;

public class UpdateImageMetadataRequestValidator : AbstractValidator<UpdateImageMetadataRequest>
{
    public const int MaxLength = 1000;

    public UpdateImageMetadataRequestValidator()
    {
        RuleFor(request => request.AltText)
            .MaximumLength(MaxLength).WithMessage($"Alt text cannot be longer than {MaxLength} characters.");

        RuleFor(request => request.Caption)
            .MaximumLength(MaxLength).WithMessage($"A caption cannot be longer than {MaxLength} characters.");
    }
}
