// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using FluentValidation;
using WebDataContracts.RequestModels.Event;

namespace Core.Validators.Events;

public class EventPostRequestValidator : AbstractValidator<EventPostRequest>
{
    public EventPostRequestValidator()
    {
        RuleFor(x => x.Body)
            .Must(b => !string.IsNullOrWhiteSpace(b))
            .WithMessage("The post cannot be empty.")
            .MaximumLength(EventRequestLimits.PostBody);
    }
}
