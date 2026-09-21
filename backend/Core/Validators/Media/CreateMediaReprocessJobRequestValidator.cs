// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using FluentValidation;
using WebDataContracts.RequestModels.Media;

namespace Core.Validators.Media;

/// <summary>
/// This file must stay under Core/Validators/: Program.cs registers validators by scanning that
/// assembly, so one placed anywhere else is silently never called.
/// </summary>
public class CreateMediaReprocessJobRequestValidator : AbstractValidator<CreateMediaReprocessJobRequest>
{
    private static readonly MediaFilterValidator FilterRules = new();

    public CreateMediaReprocessJobRequestValidator()
    {
        RuleFor(request => request)
            .Must(request => (request.MediaIdentifiers is { Count: > 0 }) ^ (request.Filter is not null))
            .WithMessage("Send either mediaIdentifiers or filter - exactly one, not both and not neither.");

        When(request => request.Filter is null, () =>
        {
            RuleFor(request => request.MediaIdentifiers)
                .NotEmpty().WithMessage("At least one image must be selected.")
                .Must(ids => ids is null || ids.Count <= MediaReprocessLimits.MaxExplicitBatchSize)
                .WithMessage($"A batch cannot contain more than {MediaReprocessLimits.MaxExplicitBatchSize} images.");

            RuleForEach(request => request.MediaIdentifiers)
                .NotEmpty().WithMessage("An image identifier cannot be blank.");
        });

        When(request => request.Filter is not null, () =>
        {
            // keep-comment: the child failures are forwarded by hand because SetValidator wants an IValidator of the NULLABLE property type; Transform was removed in FluentValidation 12 and the other two ways out are banned here - see docs/notes/fluentvalidation-child-validator-on-a-nullable-property.md
            RuleFor(request => request.Filter).Custom((filter, context) =>
            {
                if (filter is null)
                    return;

                foreach (var failure in FilterRules.Validate(filter).Errors)
                    context.AddFailure(failure);
            });
        });

        RuleFor(request => request.Options).NotNull();

        When(request => request.Options != null, () =>
        {
            RuleFor(request => request.Options.MaxWidth)
                .GreaterThan(0).When(request => request.Options.MaxWidth.HasValue)
                .WithMessage("MaxWidth must be greater than 0.");

            RuleFor(request => request.Options.MaxHeight)
                .GreaterThan(0).When(request => request.Options.MaxHeight.HasValue)
                .WithMessage("MaxHeight must be greater than 0.");

            RuleFor(request => request.Options.Quality)
                .InclusiveBetween(1, 100).When(request => request.Options.Quality.HasValue)
                .WithMessage("Quality must be between 1 and 100.");

            RuleFor(request => request.Options.Format)
                .Must(format => MediaFormats.IsOneOf(MediaFormats.Output, format))
                .WithMessage($"Format must be one of: {MediaFormats.Describe(MediaFormats.Output)}.");
        });
    }
}
