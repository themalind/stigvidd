using FluentValidation;
using WebDataContracts.RequestModels.Hike;

namespace Core.Validators.Hike;

public class CreateHikeRequestValidator : AbstractValidator<CreateHikeRequest>
{
    public CreateHikeRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(60);

        RuleFor(x => x.HikeLength)
            .GreaterThan(0)
            .LessThan(decimal.MaxValue);

        RuleFor(x => x.Duration)
            .GreaterThan(0);

        RuleFor(x => x.Coordinates)
            .NotEmpty();

        RuleFor(x => x.ParkingInfo)
            .NotEmpty()
            .MaximumLength(200)
            .When(x => x.ParkingInfo != null);

        RuleFor(x => x.GettingThere)
            .NotEmpty()
            .MaximumLength(200)
            .When(x => x.GettingThere != null);

        RuleFor(x => x.Description)
            .NotEmpty()
            .MaximumLength(500)
            .When(x => x.Description != null);
    }
}
