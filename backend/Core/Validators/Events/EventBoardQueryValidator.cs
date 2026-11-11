// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using FluentValidation;
using WebDataContracts.RequestModels.Event;

namespace Core.Validators.Events;

public class EventBoardQueryValidator : AbstractValidator<EventBoardQuery>
{
    public EventBoardQueryValidator()
    {
        RuleFor(x => x.Limit).InclusiveBetween(1, EventBoardQuery.MaxLimit);
    }
}
