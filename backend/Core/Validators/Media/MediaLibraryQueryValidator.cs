// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using FluentValidation;
using WebDataContracts.RequestModels.Media;

namespace Core.Validators.Media;

// keep-comment: must stay under Core/Validators/ - Program.cs registers validators by scanning that assembly, so one placed anywhere else is silently never called
public class MediaLibraryQueryValidator : AbstractValidator<MediaLibraryQuery>
{
    public MediaLibraryQueryValidator()
    {
        Include(new MediaFilterValidator());

        RuleFor(query => query.Page)
            .InclusiveBetween(1, MediaLibraryQuery.MaxPage)
            .WithMessage($"Page must be between 1 and {MediaLibraryQuery.MaxPage}.");

        RuleFor(query => query.PageSize)
            .InclusiveBetween(1, MediaLibraryQuery.MaxPageSize)
            .WithMessage($"PageSize must be between 1 and {MediaLibraryQuery.MaxPageSize}.");

        RuleFor(query => query.Sort)
            .Must(MediaSorts.IsKnown)
            .WithMessage($"Sort must be one of: {string.Join(", ", MediaSorts.All)}.");
    }
}
