// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using FluentValidation;
using Infrastructure.Enums;
using WebDataContracts.RequestModels.Event;

namespace Core.Validators.Events;

public class EventRoleRequestValidator : AbstractValidator<EventRoleRequest>
{
    public EventRoleRequestValidator()
    {
        RuleFor(x => x.Role)
            .Must(r => r == nameof(EventParticipantRole.CoHost) || r == nameof(EventParticipantRole.Participant))
            .WithMessage("Role must be CoHost or Participant.");
    }
}
