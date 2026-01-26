using FluentValidation;
using WebDataContracts.RequestModels.User;

namespace Core.Validators;

public class AddToUserWishlistValidator : AbstractValidator<AddToUserWishlistRequest>
{
    public AddToUserWishlistValidator()
    {
        RuleFor(addToUserWishlistRequest => addToUserWishlistRequest.TrailIdentifier)
            .NotEmpty().WithMessage("TrailIdentifier is required.")
            .Length(36).WithMessage("TrailIdentifier must be at least 36 characters long.");
    }
}
