using FluentValidation;
using WebDataContracts.RequestModels.Review;

namespace Core.Validators;

public class CreateReviewRequestValidator : AbstractValidator<CreateReviewRequest>
{
    public CreateReviewRequestValidator()
    {
        RuleFor(createReviewRequest => createReviewRequest.TrailIdentifier)
            .NotEmpty().WithMessage("TrailIdentifier is required.")
            .Length(36).WithMessage("TrailIdentifier must be at least 36 characters long.");   
        RuleFor(createReviewRequest => createReviewRequest.TrailReview)
            .MaximumLength(500);
        RuleFor(createReviewRequest => createReviewRequest.Rating)
            .Must(rating => rating >= 1M || rating <= 5M);
    }
}
