using FluentValidation;
using WebDataContracts.RequestModels.Review;

namespace Core.Validators;

public class CreateReviewRequestValidator : AbstractValidator<CreateReviewRequest>
{
    public CreateReviewRequestValidator()
    {
        RuleFor(createReviewRequest => createReviewRequest.TrailIdentifier)
            .NotEmpty().WithMessage("UserIdentifier is required.")
            .Length(36).WithMessage("UserIdentifier must be at least 36 characters long.");
        RuleFor(createReviewRequest => createReviewRequest.UserIdentifier)
            .NotEmpty().WithMessage("TrailIdentifier is required.")
            .Length(36).WithMessage("TrailIdentifier must be at least 36 characters long.");
        RuleFor(createReviewRequest => createReviewRequest.TrailReview)
            .MaximumLength(500);
        RuleFor(createReviewRequest => createReviewRequest.Grade)
            .Must(grade => grade >= 1 || grade <= 5);
    }
}
