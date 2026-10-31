// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using FluentValidation;
using WebDataContracts.RequestModels.Event;

namespace Core.Validators.Event;

public class EventFeedQueryValidator : AbstractValidator<EventFeedQuery>
{
    public EventFeedQueryValidator()
    {
        RuleFor(x => x.Limit).InclusiveBetween(1, EventFeedQuery.MaxLimit);
        RuleFor(x => x.Lat).InclusiveBetween(-90m, 90m).When(x => x.Lat.HasValue);
        RuleFor(x => x.Lon).InclusiveBetween(-180m, 180m).When(x => x.Lon.HasValue);
        RuleFor(x => x.RadiusKm).InclusiveBetween(1, EventFeedQuery.MaxRadiusKm).When(x => x.RadiusKm.HasValue);

        RuleFor(x => x)
            .Must(x => x.Lat.HasValue == x.Lon.HasValue)
            .WithMessage("Lat and Lon must be given together.");

        RuleFor(x => x)
            .Must(x => !x.RadiusKm.HasValue || x.Lat.HasValue)
            .WithMessage("RadiusKm needs Lat and Lon.");
    }
}
