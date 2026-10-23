// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using FluentValidation;
using WebDataContracts.RequestModels.Trail;

namespace Core.Validators.Trail;

public class UpdateTrailRequestValidator : AbstractValidator<UpdateTrailRequest>
{
    public UpdateTrailRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty();

        RuleFor(x => x.TrailLength)
            .GreaterThan(0);

        // 0 is the entity default and means "not classified".
        RuleFor(x => x.Classification)
            .InclusiveBetween(0, 5)
            .When(x => x.Classification.HasValue);

        RuleFor(x => x.AccessibilityInfo)
            .MaximumLength(200);

        RuleFor(x => x.TrailSymbol)
            .MaximumLength(40);

        RuleFor(x => x.Description)
            .MaximumLength(800);

        RuleFor(x => x.FullDescription)
            .MaximumLength(2000);

        RuleFor(x => x.City)
            .MaximumLength(30);

        RuleFor(x => x.VisitorInformation!)
            .SetValidator(new UpdateVisitorInformationRequestValidator())
            .When(x => x.VisitorInformation != null);

        RuleForEach(x => x.Links)
            .SetValidator(new UpdateTrailLinkRequestValidator());

        RuleFor(x => x.Links)
            .Must(links => links == null || links
                .Where(l => l.Identifier != null)
                .GroupBy(l => l.Identifier)
                .All(g => g.Count() == 1))
            .WithMessage("Each link identifier may appear only once.");
    }
}
