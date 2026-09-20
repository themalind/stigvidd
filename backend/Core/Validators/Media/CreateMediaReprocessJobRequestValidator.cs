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
    private const int MaxBatchSize = 500;

    public CreateMediaReprocessJobRequestValidator()
    {
        RuleFor(request => request.MediaIdentifiers)
            .NotEmpty().WithMessage("At least one image must be selected.")
            .Must(ids => ids.Count <= MaxBatchSize)
            .WithMessage($"A batch cannot contain more than {MaxBatchSize} images.");

        RuleForEach(request => request.MediaIdentifiers)
            .NotEmpty().WithMessage("An image identifier cannot be blank.");

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
        });
    }
}
