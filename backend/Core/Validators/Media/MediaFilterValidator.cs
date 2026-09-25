// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using FluentValidation;
using WebDataContracts.RequestModels.Media;

namespace Core.Validators.Media;

// keep-comment: one ruleset for the one MediaFilter, reached from both the GET query and the POST /reprocess body - when they were two, the same misspelled format was a clear 400 on one and "No images match that filter" on the other
public class MediaFilterValidator : AbstractValidator<MediaFilter>
{
    public MediaFilterValidator()
    {
        // keep-comment: an unknown filter value is a 400 rather than a silently ignored filter, or the operator reads a narrowed library as the whole one
        RuleFor(filter => filter.OwnerType)
            .Must(MediaOwnerTypes.IsKnown)
            .WithMessage($"OwnerType must be one of: {string.Join(", ", MediaOwnerTypes.All)}.");

        RuleFor(filter => filter.Format)
            .Must(value => MediaFormats.IsOneOf(MediaFormats.Filterable, value))
            .WithMessage($"Format must be one of: {MediaFormats.Describe(MediaFormats.Filterable)}.");

        RuleFor(filter => filter.TargetFormat)
            .Must(value => MediaFormats.IsOneOf(MediaFormats.ReprocessTarget, value))
            .WithMessage($"TargetFormat must be one of: {MediaFormats.Describe(MediaFormats.ReprocessTarget)}.");

        RuleFor(filter => filter.TargetMaxWidth)
            .GreaterThan(0).When(filter => filter.TargetMaxWidth.HasValue)
            .WithMessage("TargetMaxWidth must be greater than 0.");

        RuleFor(filter => filter.MinWidth).GreaterThanOrEqualTo(0).When(filter => filter.MinWidth.HasValue);
        RuleFor(filter => filter.MaxWidth).GreaterThanOrEqualTo(0).When(filter => filter.MaxWidth.HasValue);
        RuleFor(filter => filter.MinHeight).GreaterThanOrEqualTo(0).When(filter => filter.MinHeight.HasValue);
        RuleFor(filter => filter.MaxHeight).GreaterThanOrEqualTo(0).When(filter => filter.MaxHeight.HasValue);
        RuleFor(filter => filter.MinSizeBytes).GreaterThanOrEqualTo(0).When(filter => filter.MinSizeBytes.HasValue);
        RuleFor(filter => filter.MaxSizeBytes).GreaterThanOrEqualTo(0).When(filter => filter.MaxSizeBytes.HasValue);

        RuleFor(filter => filter)
            .Must(filter => filter.MinWidth is null || filter.MaxWidth is null || filter.MinWidth <= filter.MaxWidth)
            .WithMessage("MinWidth cannot be greater than MaxWidth.")
            .Must(filter => filter.MinHeight is null || filter.MaxHeight is null || filter.MinHeight <= filter.MaxHeight)
            .WithMessage("MinHeight cannot be greater than MaxHeight.")
            .Must(filter => filter.MinSizeBytes is null || filter.MaxSizeBytes is null || filter.MinSizeBytes <= filter.MaxSizeBytes)
            .WithMessage("MinSizeBytes cannot be greater than MaxSizeBytes.")
            .Must(filter => filter.CreatedFrom is null || filter.CreatedTo is null || filter.CreatedFrom < filter.CreatedTo)
            .WithMessage("CreatedFrom must be earlier than CreatedTo.");
    }
}
