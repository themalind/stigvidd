// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using FluentValidation;
using WebDataContracts.RequestModels.HikeShare;

namespace Core.Validators.HikeShare;

public class HikeShareReshareValidator : AbstractValidator<ReshareSharedHikeRequest>
{
    public HikeShareReshareValidator()
    {
        RuleFor(hsr => hsr.HikeIdentifier)
            .NotEmpty()
                .WithMessage("HikeIdentifier is required.")
            .Length(36)
                .WithMessage("HikeIdentifier must be at least 36 characters long.");
        RuleFor(hsr => hsr.ReShareToNames).RecipientNames();
    }
}
