// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using FluentValidation;
using Infrastructure.Enums;
using WebDataContracts.RequestModels.Facility;

namespace Core.Validators.Facilities;

public class FacilityImportRequestValidator : AbstractValidator<FacilityImportRequest>
{
    public const int MaxGeoJsonLength = 5_000_000;
    public const int MaxFieldLength = 100;

    public FacilityImportRequestValidator()
    {
        RuleFor(r => r.SourceIdentifier)
            .NotEmpty().WithMessage("Choose a data source.")
            .MaximumLength(100);

        RuleFor(r => r.GeoJson)
            .NotEmpty()
            .MaximumLength(MaxGeoJsonLength).WithMessage("The file is too large.");

        RuleFor(r => r.Mapping).NotNull();
        RuleFor(r => r.Mapping.NameField).NotEmpty().WithMessage("Choose the field that holds the name.").MaximumLength(MaxFieldLength);
        RuleFor(r => r.Mapping.IdField).MaximumLength(MaxFieldLength);
        RuleFor(r => r.Mapping.DescriptionField).MaximumLength(MaxFieldLength);
        RuleFor(r => r.Mapping.UrlField).MaximumLength(MaxFieldLength);
        RuleFor(r => r.Mapping.TypeField).MaximumLength(MaxFieldLength);

        RuleFor(r => r.Mapping.FixedType)
            .Must(FacilityTypes.IsKnown)
            .When(r => string.IsNullOrWhiteSpace(r.Mapping.TypeField))
            .WithMessage("Choose a facility type for the file.");

        RuleFor(r => r.Mapping.TypeValues)
            .NotNull()
            .Must(values => values.Count <= 200).WithMessage("Too many type values.");

        RuleForEach(r => r.Mapping.TypeValues).ChildRules(value =>
        {
            value.RuleFor(v => v.Value).NotNull().MaximumLength(200);
            // keep-comment: 0 maps a value to no type, so the reader skips those points
            value.RuleFor(v => v.FacilityType)
                .Must(type => type == 0 || FacilityTypes.IsKnown(type))
                .WithMessage("Unknown facility type.");
        });

        RuleFor(r => r.Links)
            .NotNull()
            .Must(links => links.Count <= 1000).WithMessage("Too many links.");

        RuleForEach(r => r.Links).ChildRules(link =>
        {
            link.RuleFor(l => l.SourceId).NotEmpty().MaximumLength(200);
            link.RuleFor(l => l.FacilityIdentifier).MaximumLength(100);
        });

        RuleFor(r => r.Kept)
            .NotNull()
            .Must(kept => kept.Count <= 4000).WithMessage("Too many kept fields.");

        RuleForEach(r => r.Kept).ChildRules(keep =>
        {
            keep.RuleFor(k => k.SourceId).NotEmpty().MaximumLength(200);
            keep.RuleFor(k => k.Field).IsInEnum();
        });
    }
}
