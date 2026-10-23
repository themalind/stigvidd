// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using FluentValidation;
using WebDataContracts.RequestModels.HikeSubmission;

namespace Core.Validators.HikeSubmission;

public class CreateHikeSubmissionRequestValidator : AbstractValidator<CreateHikeSubmissionRequest>
{
    public CreateHikeSubmissionRequestValidator()
    {
        RuleFor(x => x.HikeIdentifier).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(HikeSubmissionLimits.Name);
        RuleFor(x => x.Description).NotEmpty().MaximumLength(HikeSubmissionLimits.Description);
        RuleFor(x => x.Classification).InclusiveBetween(1, 3);
        RuleFor(x => x.Parking).MaximumLength(HikeSubmissionLimits.ShortText);
        RuleFor(x => x.GettingThere).NotEmpty().MaximumLength(HikeSubmissionLimits.ShortText);
        RuleFor(x => x.PublicTransport).MaximumLength(HikeSubmissionLimits.ShortText);
        RuleFor(x => x.AccessibilityInfo).MaximumLength(HikeSubmissionLimits.AccessibilityInfo);
        RuleFor(x => x.City).NotEmpty().MaximumLength(HikeSubmissionLimits.City);
        RuleFor(x => x.AcceptTransfer).Equal(true).WithMessage("The transfer to Stigvidd must be accepted.");
        RuleFor(x => x.ConsentVersion).Equal(HikeSubmissionConsent.CurrentVersion)
            .WithMessage("The consent text has changed. Update the app and accept it again.");
        RuleFor(x => x.ConsentLocale).NotEmpty().MaximumLength(8);
        RuleFor(x => x.TrimStartIndex).GreaterThanOrEqualTo(0).When(x => x.TrimStartIndex.HasValue);
        RuleFor(x => x.TrimEndIndex).GreaterThan(x => x.TrimStartIndex ?? 0).When(x => x.TrimEndIndex.HasValue);
        RuleFor(x => x.ImageIdentifiers).Cascade(CascadeMode.Stop)
            .NotNull()
            .Must(ids => ids.Count <= HikeSubmissionLimits.Images);
    }
}
