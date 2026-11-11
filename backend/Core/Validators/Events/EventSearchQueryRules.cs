// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Services;
using FluentValidation;
using WebDataContracts.Enums;
using WebDataContracts.RequestModels.Event;

namespace Core.Validators.Events;

public abstract class EventSearchQueryRules<T> : AbstractValidator<T> where T : EventSearchQuery
{
    protected EventSearchQueryRules()
    {
        RuleFor(x => x.Limit).InclusiveBetween(1, EventSearchQuery.MaxLimit);
        RuleFor(x => x.Search).MaximumLength(EventSearchQuery.MaxSearchLength);

        RuleFor(x => x.Lat).InclusiveBetween(-90m, 90m).When(x => x.Lat.HasValue);
        RuleFor(x => x.Lon).InclusiveBetween(-180m, 180m).When(x => x.Lon.HasValue);
        RuleFor(x => x.RadiusKm).InclusiveBetween(1, EventSearchQuery.MaxRadiusKm).When(x => x.RadiusKm.HasValue);

        RuleFor(x => x)
            .Must(x => x.Lat.HasValue == x.Lon.HasValue)
            .WithMessage("Lat and Lon must be given together.");

        RuleFor(x => x)
            .Must(x => !x.RadiusKm.HasValue || x.Lat.HasValue)
            .WithMessage("RadiusKm needs Lat and Lon.");

        RuleFor(x => x.Sort).IsInEnum();
        RuleFor(x => x)
            .Must(x => x.Sort != EventSort.Distance || x.Lat.HasValue)
            .WithMessage("Sort=Distance needs Lat and Lon.");

        RuleFor(x => x.To)
            .Must((x, to) => UtcDates.ToUtc(to) > UtcDates.ToUtc(x.From))
            .When(x => x.From.HasValue && x.To.HasValue)
            .WithMessage("To must be after From.");

        RuleFor(x => x.MinLengthKm).InclusiveBetween(0m, EventSearchQuery.LengthKmCeiling).When(x => x.MinLengthKm.HasValue);
        RuleFor(x => x.MaxLengthKm).InclusiveBetween(0m, EventSearchQuery.LengthKmCeiling).When(x => x.MaxLengthKm.HasValue);
        RuleFor(x => x.MaxLengthKm)
            .GreaterThanOrEqualTo(x => x.MinLengthKm)
            .When(x => x.MinLengthKm.HasValue && x.MaxLengthKm.HasValue);

        RuleFor(x => x.RouteKind).IsInEnum().When(x => x.RouteKind.HasValue);
    }
}
