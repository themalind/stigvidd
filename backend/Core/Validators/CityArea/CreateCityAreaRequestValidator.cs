using FluentValidation;
using WebDataContracts.RequestModels.CityArea;

namespace Core.Validators.CityArea;

public class CreateCityAreaRequestValidator : AbstractValidator<CreateCityAreaRequest>
{
    public CreateCityAreaRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Name is required.")
            .MaximumLength(100).WithMessage("Name must not exceed 100 characters.");
        RuleFor(x => x.Location)
            .NotEmpty().WithMessage("Location is required.")
            .MaximumLength(200).WithMessage("Location must not exceed 200 characters.");
        RuleFor(x => x.Description)
            .MaximumLength(500).WithMessage("Description must not exceed 500 characters.");
        RuleFor(x => x.Url)
            .MaximumLength(200).WithMessage("Url must not exceed 200 characters.")
            .WithMessage("Url must be a valid URL.");
    }
}
