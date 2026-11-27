// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using FluentValidation;
using WebDataContracts.RequestModels.Review;

namespace Core.Validators.Trails;

// The image count after the edit is checked by ReviewService. keep-comment: the validator cannot see the stored images
public class UpdateReviewRequestValidator : AbstractValidator<UpdateReviewRequest>
{
    public UpdateReviewRequestValidator()
    {
        RuleFor(request => request.TrailReview)
            .MaximumLength(500);
        RuleFor(request => request.Rating)
            .InclusiveBetween(1M, 5M);
        RuleForEach(request => request.RemovedImageIdentifiers)
            .NotEmpty();
    }
}
