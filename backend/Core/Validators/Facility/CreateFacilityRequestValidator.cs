using FluentValidation;
using WebDataContracts.RequestModels.Facility;

namespace Core.Validators.Facility;

public class CreateFacilityRequestValidator : AbstractValidator<CreateFacilityRequest>
{
    public CreateFacilityRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .WithMessage("Name is required.");
        RuleFor(x => x.FacilityType)
            .NotEmpty()
            .WithMessage("FacilityType is required.");
        RuleFor(x => x.Latitude)
            .InclusiveBetween(-90, 90)
            .WithMessage("Latitude must be between -90 and 90.")
            .When(x => x.Latitude.HasValue);
        RuleFor(x => x.Longitude)
            .InclusiveBetween(-180, 180)
            .WithMessage("Longitude must be between -180 and 180.")
            .When(x => x.Longitude.HasValue);
        RuleFor(x => x.Location)
            .MaximumLength(200)
            .WithMessage("Location must not exceed 200 characters.")
            .When(x => x.Location != null);
        RuleFor(x => x.Description)
            .MaximumLength(200)
            .WithMessage("Description must not exceed 200 characters.")
            .When(x => x.Description != null);
        RuleFor(x => x.Url)
            .MaximumLength(200)
            .WithMessage("Url must not exceed 200 characters.")
            .When(x => x.Url != null);
    }
}