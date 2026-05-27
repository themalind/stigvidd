using FluentValidation;
using WebDataContracts.RequestModels.Trail;

public class UpdateTrailRequestValidator : AbstractValidator<UpdateTrailRequest>
{
    public UpdateTrailRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty();

        RuleFor(x => x.TrailLength)
            .GreaterThan(0);

        RuleFor(x => x.Classification)
            .InclusiveBetween(1, 5)
            .When(x => x.Classification.HasValue);

        RuleFor(x => x.AccessibilityInfo)
            .NotEmpty()
            .MaximumLength(200)
            .When(x => x.AccessibilityInfo != null);

        RuleFor(x => x.TrailSymbol)
            .NotEmpty()
            .MaximumLength(60)
            .When(x => x.TrailSymbol != null);

        RuleFor(x => x.Description)
            .NotEmpty()
            .MaximumLength(500)
            .When(x => x.Description != null);

        RuleFor(x => x.FullDescription)
            .NotEmpty()
            .MinimumLength(1000)
            .When(x => x.FullDescription != null);

        RuleFor(x => x.Tags)
            .NotEmpty()
            .When(x => x.Tags != null);

        RuleFor(x => x.City)
            .NotEmpty()
            .MaximumLength(100)
            .When(x => x.City != null);

        RuleFor(x => x.VisitorInformation!)
            .SetValidator(new UpdateVisitorInformationRequestValidator())
            .When(x => x.VisitorInformation != null);
    }
}