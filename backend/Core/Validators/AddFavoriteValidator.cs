using FluentValidation;
using WebDataContracts.RequestModels;

namespace Core.Validators;

public class AddFavoriteValidator : AbstractValidator<AddToUserFavoritesRequest>
{
    public AddFavoriteValidator()
    {
        RuleFor(af => af.UserIdentifier)
            .NotEmpty().WithMessage("UserIdentifier is required.");
        RuleFor(af => af.TrailIdentifier)
            .NotEmpty().WithMessage("TrailIdentifier is required.");
    }
}
