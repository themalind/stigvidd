// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using FluentValidation;
using WebDataContracts.RequestModels.Trail;

public class UpdateTrailLinkRequestValidator : AbstractValidator<UpdateTrailLinkRequest>
{
    public UpdateTrailLinkRequestValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty()
            .MaximumLength(100);

        RuleFor(x => x.Link)
            .NotEmpty()
            .MaximumLength(500)
            .Must(BeHttpUrl)
            .WithMessage("Link must be an absolute http or https URL.");
    }

    private static bool BeHttpUrl(string link) =>
        Uri.TryCreate(link, UriKind.Absolute, out var uri)
        && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
}
