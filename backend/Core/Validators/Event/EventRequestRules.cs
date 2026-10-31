// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Services;
using FluentValidation;
using WebDataContracts.RequestModels.Event;

namespace Core.Validators.Event;

public abstract class EventRequestRules<T> : AbstractValidator<T> where T : EventRequest
{
    protected EventRequestRules()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(EventRequestLimits.Title);
        RuleFor(x => x.Description).NotNull().MaximumLength(EventRequestLimits.Description);
        RuleFor(x => x.LocationName).MaximumLength(EventRequestLimits.PlaceName);
        RuleFor(x => x.MeetingPointName).MaximumLength(EventRequestLimits.PlaceName);

        RuleFor(x => x.MeetingPointLatitude).InclusiveBetween(-90m, 90m).When(x => x.MeetingPointLatitude.HasValue);
        RuleFor(x => x.MeetingPointLongitude).InclusiveBetween(-180m, 180m).When(x => x.MeetingPointLongitude.HasValue);

        // The pair travels together: one without the other is not a place. keep-comment: srid-4326 note
        RuleFor(x => x)
            .Must(x => x.MeetingPointLatitude.HasValue == x.MeetingPointLongitude.HasValue)
            .WithMessage("MeetingPointLatitude and MeetingPointLongitude must be given together.");

        RuleFor(x => x)
            .Must(x => string.IsNullOrWhiteSpace(x.TrailIdentifier) || string.IsNullOrWhiteSpace(x.HikeIdentifier))
            .WithMessage("An event follows a trail or a hike, not both.");

        RuleFor(x => x.RouteTrimStartIndex).GreaterThanOrEqualTo(0).When(x => x.RouteTrimStartIndex.HasValue);
        RuleFor(x => x.RouteTrimEndIndex).GreaterThan(x => x.RouteTrimStartIndex ?? 0).When(x => x.RouteTrimEndIndex.HasValue);
        RuleFor(x => x)
            .Must(x => !string.IsNullOrWhiteSpace(x.HikeIdentifier) || (!x.RouteTrimStartIndex.HasValue && !x.RouteTrimEndIndex.HasValue))
            .WithMessage("Trim indexes need a HikeIdentifier.");

        RuleFor(x => x.EndsAt)
            .Must((x, endsAt) => UtcDates.ToUtc(endsAt) > UtcDates.ToUtc(x.StartsAt))
            .When(x => x.EndsAt.HasValue)
            .WithMessage("EndsAt must be after StartsAt.");
        RuleFor(x => x.EndsAt)
            .Must((x, endsAt) => UtcDates.ToUtc(endsAt) - UtcDates.ToUtc(x.StartsAt) <= EventRequestLimits.MaxDuration)
            .When(x => x.EndsAt.HasValue)
            .WithMessage($"An event lasts at most {EventRequestLimits.MaxDuration.Days} days.");
        RuleFor(x => x.StartsAt)
            .Must(startsAt => UtcDates.ToUtc(startsAt) <= DateTime.UtcNow + EventRequestLimits.MaxLeadTime)
            .WithMessage($"An event starts at most {EventRequestLimits.MaxLeadTime.Days} days ahead.");
        RuleFor(x => x.RegistrationDeadline)
            .Must((x, deadline) => UtcDates.ToUtc(deadline) <= UtcDates.ToUtc(x.StartsAt))
            .When(x => x.RegistrationDeadline.HasValue)
            .WithMessage("RegistrationDeadline must not be after StartsAt.");
        RuleFor(x => x.MaxParticipants)
            .InclusiveBetween(EventRequestLimits.MinParticipants, EventRequestLimits.MaxParticipants)
            .When(x => x.MaxParticipants.HasValue);
    }
}
