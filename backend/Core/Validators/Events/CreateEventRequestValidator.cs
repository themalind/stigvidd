// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Services;
using FluentValidation;
using Infrastructure.Enums;
using WebDataContracts.RequestModels.Event;

namespace Core.Validators.Events;

public class CreateEventRequestValidator : EventRequestRules<CreateEventRequest>
{
    public CreateEventRequestValidator()
    {
        RuleFor(x => x.Visibility)
            .Must(v => Enum.GetNames<EventVisibility>().Contains(v))
            .WithMessage("Visibility must be Open or Private.");

        RuleFor(x => x.StartsAt).Must(startsAt => UtcDates.ToUtc(startsAt) > DateTime.UtcNow).WithMessage("The event must start in the future.");

        // On edit only a changed deadline must be ahead, which only EventService can see. keep-comment: why this rule is create-only
        RuleFor(x => x.RegistrationDeadline)
            .Must(deadline => UtcDates.ToUtc(deadline) >= DateTime.UtcNow)
            .When(x => x.RegistrationDeadline.HasValue)
            .WithMessage("RegistrationDeadline must not be in the past.");

        // Every event needs a point for "near me". On edit a stored route counts too, which only EventService can see. keep-comment: why this rule is create-only
        RuleFor(x => x)
            .Must(x => x.MeetingPointLatitude.HasValue
                || !string.IsNullOrWhiteSpace(x.TrailIdentifier)
                || !string.IsNullOrWhiteSpace(x.HikeIdentifier))
            .WithMessage("An event needs a meeting point, a trail or a hike.");
    }
}
