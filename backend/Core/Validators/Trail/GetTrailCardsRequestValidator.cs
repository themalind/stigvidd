using FluentValidation;
using WebDataContracts.RequestModels.Trail;

namespace Core.Validators.Trail;

public class GetTrailCardsRequestValidator : AbstractValidator<GetTrailCardsRequest>
{
    // Cap the batch so a single request can't ask for an unbounded number of cards.
    private const int MaxIdentifiers = 50;

    public GetTrailCardsRequestValidator()
    {
        RuleFor(request => request.Identifiers)
            .NotEmpty().WithMessage("At least one identifier is required.")
            .Must(identifiers => identifiers.Count <= MaxIdentifiers)
            .WithMessage($"A maximum of {MaxIdentifiers} identifiers can be requested at once.");

        RuleForEach(request => request.Identifiers)
            .NotEmpty().WithMessage("Identifier cannot be empty.");
    }
}
