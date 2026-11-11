// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using FluentValidation;
using Infrastructure.Enums;
using WebDataContracts.RequestModels.Facility;

namespace Core.Validators.Trails;

public class SaveFacilityRequestValidator : AbstractValidator<SaveFacilityRequest>
{
    public const int NameMaxLength = 100;
    public const int LocationMaxLength = 200;
    public const int DescriptionMaxLength = 2000;
    public const int UrlMaxLength = 500;

    public SaveFacilityRequestValidator()
    {
        RuleFor(x => x.Name)
            .Must(name => !string.IsNullOrWhiteSpace(name))
            .WithMessage("Name is required.")
            .MaximumLength(NameMaxLength)
            .WithMessage($"Name must not exceed {NameMaxLength} characters.");
        RuleFor(x => x.FacilityType)
            .NotEqual(0)
            .WithMessage("FacilityType is required.")
            .Must(FacilityTypes.IsKnown)
            .WithMessage("FacilityType must be a combination of the known facility types.");
        RuleFor(x => x.Latitude)
            .InclusiveBetween(-90, 90)
            .WithMessage("Latitude must be between -90 and 90.")
            .When(x => x.Latitude.HasValue);
        RuleFor(x => x.Longitude)
            .InclusiveBetween(-180, 180)
            .WithMessage("Longitude must be between -180 and 180.")
            .When(x => x.Longitude.HasValue);
        RuleFor(x => x.Latitude)
            .Must((request, _) => request.Latitude.HasValue == request.Longitude.HasValue)
            .WithMessage("Latitude and longitude must be supplied together.");
        RuleFor(x => x.Location)
            .NotNull()
            .MaximumLength(LocationMaxLength)
            .WithMessage($"Location must not exceed {LocationMaxLength} characters.");
        RuleFor(x => x.Description)
            .NotNull()
            .MaximumLength(DescriptionMaxLength)
            .WithMessage($"Description must not exceed {DescriptionMaxLength} characters.");
        RuleFor(x => x.Url)
            .NotNull()
            .MaximumLength(UrlMaxLength)
            .WithMessage($"Url must not exceed {UrlMaxLength} characters.")
            .Must(BeEmptyOrAbsoluteHttpUrl)
            .WithMessage("Url must be empty or an absolute http or https address.");
    }

    private static bool BeEmptyOrAbsoluteHttpUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            return true;
        }

        return Uri.TryCreate(url.Trim(), UriKind.Absolute, out var uri)
            && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
    }
}
