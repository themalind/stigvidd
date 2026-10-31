// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using FluentValidation;
using WebDataContracts.RequestModels.Event;

namespace Core.Validators.Event;

public class EventInviteRequestValidator : AbstractValidator<EventInviteRequest>
{
    public EventInviteRequestValidator()
    {
        RuleFor(x => x.NickNames)
            .NotEmpty()
            .Must(names => names.Count <= EventRequestLimits.InvitesPerRequest)
            .WithMessage($"At most {EventRequestLimits.InvitesPerRequest} people can be invited at once.");

        RuleForEach(x => x.NickNames).NotEmpty();
    }
}
