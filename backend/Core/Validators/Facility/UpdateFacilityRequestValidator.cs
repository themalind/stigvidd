// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using FluentValidation;
using WebDataContracts.RequestModels.Facility;

namespace Core.Validators.Facility;

public class UpdateFacilityRequestValidator : AbstractValidator<UpdateFacilityRequest>
{
    public UpdateFacilityRequestValidator()
    {
        RuleFor(x => x.Name)
             .NotEmpty()
             .WithMessage("Name is required.")
             .When(x => x.Name != null);
        RuleFor(x => x.FacilityType)
            .Must(value => FacilityTypes.IsKnown(value.GetValueOrDefault()))
            .WithMessage("FacilityType must be a combination of the known facility types.")
            .When(x => x.FacilityType.HasValue);
        RuleFor(x => x.Latitude)
            .InclusiveBetween(-90, 90)
            .WithMessage("Latitude must be between -90 and 90.")
            .When(x => x.Latitude.HasValue);
        RuleFor(x => x.Longitude)
            .InclusiveBetween(-180, 180)
            .WithMessage("Longitude must be between -180 and 180.")
            .When(x => x.Longitude.HasValue);
        // Latitude and longitude are stored as a single Point, so a half pair is not a
        // location the entity can hold. Reject it rather than silently dropping the ordinate.
        RuleFor(x => x.Latitude)
            .Must((request, _) => request.Latitude.HasValue == request.Longitude.HasValue)
            .WithMessage("Latitude and longitude must be supplied together.");
        RuleFor(x => x.Location)
            .MaximumLength(200)
            .WithMessage("Location must not exceed 200 characters.")
            .When(x => x.Location != null);
        RuleFor(x => x.Description)
            .MaximumLength(200)
            .WithMessage("Description must not exceed 200 characters.")
            .When(x => x.Description != null);
        RuleFor(x => x.Url)
            .MaximumLength(200)
            .WithMessage("Url must not exceed 200 characters.")
            .When(x => x.Url != null);
    }
}
