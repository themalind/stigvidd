// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using FluentValidation;
using WebDataContracts.RequestModels.HikeSubmission;

namespace Core.Validators.HikeSubmission;

public class RejectHikeSubmissionRequestValidator : AbstractValidator<RejectHikeSubmissionRequest>
{
    public RejectHikeSubmissionRequestValidator()
    {
        RuleFor(x => x.Reason).NotEmpty().MaximumLength(HikeSubmissionLimits.Description);
    }
}
