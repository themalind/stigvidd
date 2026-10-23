// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using FluentValidation;
using WebDataContracts.RequestModels.HikeSubmission;

namespace Core.Validators.HikeSubmission;

public class UpdateHikeSubmissionRequestValidator : AbstractValidator<UpdateHikeSubmissionRequest>
{
    public UpdateHikeSubmissionRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(HikeSubmissionLimits.Name);
        RuleFor(x => x.Description).NotEmpty().MaximumLength(HikeSubmissionLimits.Description);
        RuleFor(x => x.Classification).InclusiveBetween(1, 3);
        RuleFor(x => x.Parking).MaximumLength(HikeSubmissionLimits.ShortText);
        RuleFor(x => x.GettingThere).NotEmpty().MaximumLength(HikeSubmissionLimits.ShortText);
        RuleFor(x => x.PublicTransport).MaximumLength(HikeSubmissionLimits.ShortText);
        RuleFor(x => x.AccessibilityInfo).MaximumLength(HikeSubmissionLimits.AccessibilityInfo);
        RuleFor(x => x.City).NotEmpty().MaximumLength(HikeSubmissionLimits.City);
    }
}
