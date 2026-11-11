// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using FluentValidation;
using WebDataContracts.RequestModels.Event;

namespace Core.Validators.Events;

// "StartsAt in the future", "deadline not past" and "needs a place" are checked by EventService. keep-comment: the validator cannot see the stored StartsAt, deadline or route
public class UpdateEventRequestValidator : EventRequestRules<UpdateEventRequest>
{
    public UpdateEventRequestValidator()
    {
        RuleFor(x => x)
            .Must(x => !x.RemoveRoute || string.IsNullOrWhiteSpace(x.HikeIdentifier))
            .WithMessage("RemoveRoute and HikeIdentifier cannot both be given.");
    }
}
