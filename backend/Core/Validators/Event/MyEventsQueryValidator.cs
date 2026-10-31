// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using FluentValidation;
using WebDataContracts.RequestModels.Event;

namespace Core.Validators.Event;

public class MyEventsQueryValidator : AbstractValidator<MyEventsQuery>
{
    public MyEventsQueryValidator()
    {
        RuleFor(x => x.Limit).InclusiveBetween(1, EventFeedQuery.MaxLimit);
    }
}
