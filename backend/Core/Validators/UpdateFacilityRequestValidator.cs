using FluentValidation;
using WebDataContracts.RequestModels.Facility;

namespace Core.Validators;

public class UpdateFacilityRequestValidator : AbstractValidator<UpdateFacilityRequest>
{
    public UpdateFacilityRequestValidator()
    {
        RuleFor(x => x.Name)
             .NotEmpty()
             .WithMessage("Name is required.")
             .When(x => x.Name != null);
        RuleFor(x => x.FacilityType)
            .NotEmpty()
            .WithMessage("FacilityType is required.")
            .When(x => x.FacilityType.HasValue);
        RuleFor(x => x.Latitude)
            .InclusiveBetween(-90, 90)
            .WithMessage("Latitude must be between -90 and 90.")
            .When(x => x.Latitude.HasValue);
        RuleFor(x => x.Longitude)
            .InclusiveBetween(-180, 180)
            .WithMessage("Longitude must be between -180 and 180.")
            .When(x => x.Longitude.HasValue);
    }
}
