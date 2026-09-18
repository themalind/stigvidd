// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using FluentValidation;
using WebDataContracts.RequestModels.MailOutbox;

namespace Core.Validators.MailOutbox;

/// <summary>
/// The two rules standing between a typo and an emptied outbox.
/// </summary>
/// <remarks>
/// This file must stay under Core/Validators/: Program.cs registers validators by scanning that
/// assembly, so one placed anywhere else is silently never called — which here would mean
/// Confirm = false purging the table with no error raised anywhere.
/// </remarks>
public class PurgeMailOutboxRequestValidator : AbstractValidator<PurgeMailOutboxRequest>
{
    public PurgeMailOutboxRequestValidator()
    {
        // The floor is the guard, not a nicety: 0 is the JSON default for an omitted int, so
        // without it a client that forgets the field purges every sent mail in the table.
        RuleFor(request => request.OlderThanDays)
            .GreaterThanOrEqualTo(1).WithMessage("OlderThanDays must be at least 1.")
            .LessThanOrEqualTo(3650).WithMessage("OlderThanDays must be at most 3650.");

        RuleFor(request => request.Confirm)
            .Equal(true).WithMessage("Confirm must be true to purge sent mail.");
    }
}
