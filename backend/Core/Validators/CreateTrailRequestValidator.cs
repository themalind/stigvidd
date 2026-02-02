using FluentValidation;
using WebDataContracts.RequestModels.Trail;

namespace Core.Validators;

public class CreateTrailRequestValidator : AbstractValidator<CreateTrailRequest>
{
    public CreateTrailRequestValidator()
    {
        RuleFor(CreateTrailRequest => CreateTrailRequest.Name)
            .NotEmpty().WithMessage("Trail name is required")
            .MaximumLength(60);
        RuleFor(CreateTrailRequest => CreateTrailRequest.TrailLength)
            .GreaterThan(0)
            .LessThan(double.MaxValue);
        
        // wip
    }
}