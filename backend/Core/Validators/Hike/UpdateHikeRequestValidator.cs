// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using FluentValidation;
using WebDataContracts.RequestModels.Hike;

namespace Core.Validators.Hike;

public class UpdateHikeRequestValidator : AbstractValidator<UpdateHikeRequest>
{
    public UpdateHikeRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(40)
            .WithMessage("Name cannot be empty.")
            .When(x => x.Name != null);
        RuleFor(x => x.ParkingInfo)
            .NotEmpty()
            .MaximumLength(200)
            .WithMessage("ParkingInfo cannot be empty.")
            .When(x => x.ParkingInfo != null);
        RuleFor(x => x.GettingThere)
            .NotEmpty()
            .MaximumLength(200)
            .WithMessage("GettingThere cannot be empty.")
            .When(x => x.GettingThere != null);
        RuleFor(x => x.Description)
            .NotEmpty()
            .MaximumLength(500)
            .WithMessage("Description cannot be empty.")
            .When(x => x.Description != null);
    }
}
