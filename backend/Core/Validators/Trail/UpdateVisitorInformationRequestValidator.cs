using FluentValidation;
using WebDataContracts.RequestModels.Trail;

public class UpdateVisitorInformationRequestValidator
    : AbstractValidator<UpdateVisitorInformationRequest>
{
    public UpdateVisitorInformationRequestValidator()
    {
        RuleFor(x => x.GettingThere)
            .MaximumLength(400);

        RuleFor(x => x.PublicTransport)
            .MaximumLength(400);

        RuleFor(x => x.Parking)
            .MaximumLength(400);

        RuleFor(x => x.IlluminationText)
            .MaximumLength(400);

        RuleFor(x => x.MaintainedBy)
            .MaximumLength(100);
    }
}
