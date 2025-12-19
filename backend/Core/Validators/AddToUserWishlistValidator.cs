using FluentValidation;
using WebDataContracts.RequestModels;

namespace Core.Validators;

public class AddToUserWishlistValidator : AbstractValidator<AddToUserWishlistRequest>
{
    public AddToUserWishlistValidator()
    {
        RuleFor(af => af.UserIdentifier)
            .NotEmpty().WithMessage("UserIdentifier is required.")
            .Length(36).WithMessage("UserIdentifier must be at least 36 characters long.");
        RuleFor(af => af.TrailIdentifier)
            .NotEmpty().WithMessage("TrailIdentifier is required.")
            .Length(36).WithMessage("TrailIdentifier must be at least 36 characters long.");
    }
}
