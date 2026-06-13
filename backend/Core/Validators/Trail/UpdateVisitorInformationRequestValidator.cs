using FluentValidation;
using WebDataContracts.RequestModels.Trail;

public class UpdateVisitorInformationRequestValidator
    : AbstractValidator<UpdateVisitorInformationRequest>
{
    public UpdateVisitorInformationRequestValidator()
    {
        RuleFor(x => x.GettingThere)
            .NotEmpty()
            .MaximumLength(200)
            .When(x => x.GettingThere != null);

        RuleFor(x => x.PublicTransport)
            .NotEmpty()
            .MaximumLength(200)
            .When(x => x.PublicTransport != null);

        RuleFor(x => x.Parking)
            .NotEmpty()
            .MaximumLength(200)
            .When(x => x.Parking != null);

        RuleFor(x => x.IlluminationText)
            .NotEmpty()
            .MaximumLength(200)
            .When(x => x.IlluminationText != null);

        RuleFor(x => x.MaintainedBy)
            .NotEmpty()
            .MaximumLength(100)
            .When(x => x.MaintainedBy != null);
    }
}