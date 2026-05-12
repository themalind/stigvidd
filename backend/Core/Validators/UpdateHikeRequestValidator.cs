using FluentValidation;
using WebDataContracts.RequestModels.Hike;

namespace Core.Validators;

public class UpdateHikeRequestValidator : AbstractValidator<UpdateHikeRequest>
{
    public UpdateHikeRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(60)
            .WithMessage("Name cannot be empty.")
            .When(x => x.Name != null);
        RuleFor(x => x.ParkingInfo)
            .NotEmpty()
            .MaximumLength(200)
            .WithMessage("ParkingInfo cannot be empty.")
            .When(x => x.ParkingInfo != null);
        RuleFor(x => x.GettingThere)
            .NotEmpty()
            .MaximumLength(200)
            .WithMessage("GettingThere cannot be empty.")
            .When(x => x.GettingThere != null);
        RuleFor(x => x.Description)
            .NotEmpty()
            .MaximumLength(500)
            .WithMessage("Description cannot be empty.")
            .When(x => x.Description != null);
    }
}
