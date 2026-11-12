// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Services;
using FluentValidation;
using WebDataContracts.RequestModels.Facility;

namespace Core.Validators.Facilities;

public class CreateFacilityImportSourceRequestValidator : AbstractValidator<CreateFacilityImportSourceRequest>
{
    public CreateFacilityImportSourceRequestValidator()
    {
        RuleFor(r => r.MunicipalityIdentifier)
            .NotEmpty().WithMessage("Choose a municipality.")
            .MaximumLength(100);

        RuleFor(r => r.Name)
            .NotEmpty()
            .MaximumLength(100)
            .Must(Slug.Fits)
            .WithMessage(Slug.FitsMessage);
    }
}
