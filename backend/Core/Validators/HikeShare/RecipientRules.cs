// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using FluentValidation;

namespace Core.Validators.HikeShare;

// keep-comment: a rule extension, not an AbstractValidator<IReadOnlyCollection<string>>, which the assembly scan would attach to other endpoints
public static class RecipientRules
{
    public const int MaxRecipients = 10;

    public static IRuleBuilderOptions<T, IEnumerable<string>> RecipientNames<T>(
        this IRuleBuilderInitial<T, IReadOnlyCollection<string>> rule) =>
        rule.Cascade(CascadeMode.Stop)
            .NotEmpty()
                .WithMessage("At least one recipient is required.")
            .Must(names => names.Count <= MaxRecipients)
                .WithMessage($"A hike can be shared with at most {MaxRecipients} recipients at a time.")
            .ForEach(name => name
                .NotEmpty()
                    .WithMessage("Shared with Name is required.")
                .MaximumLength(20)
                    .WithMessage("Shared with Name cannot exceed 20 characters."));
}
