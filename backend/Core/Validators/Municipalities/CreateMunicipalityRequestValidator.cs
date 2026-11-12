// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Services;
using FluentValidation;
using WebDataContracts.RequestModels.Municipality;

namespace Core.Validators.Municipalities;

public class CreateMunicipalityRequestValidator : AbstractValidator<CreateMunicipalityRequest>
{
    public CreateMunicipalityRequestValidator()
    {
        RuleFor(r => r.Name)
            .NotEmpty()
            .MaximumLength(100)
            .Must(Slug.Fits)
            .WithMessage(Slug.FitsMessage);
    }
}
