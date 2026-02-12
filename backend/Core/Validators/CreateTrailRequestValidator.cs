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
            .LessThan(decimal.MaxValue);
        RuleFor(CreateTrailRequest => CreateTrailRequest.Classification)
            .NotEmpty().WithMessage("Must contain a classification")
            .GreaterThan(0)
            .LessThan(4);
        RuleFor(CreateTrailRequest => CreateTrailRequest.AccessibilityInfo)
            .MaximumLength(1024);
        RuleFor(CreateTrailRequest => CreateTrailRequest.TrailSymbol)
            .MaximumLength(32);
        RuleFor(CreateTrailRequest => CreateTrailRequest.Description)
            .NotEmpty().WithMessage("Short description is required")
            .MaximumLength(256);
        RuleFor(CreateTrailRequest => CreateTrailRequest.FullDescription)
            .MaximumLength(1024);
        RuleFor(CreateTrailRequest => CreateTrailRequest.City)
            .NotEmpty().WithMessage("City is requierd")
            .MaximumLength(128);
    }
}