using FluentValidation;
using WebDataContracts.RequestModels.HikeShare;

namespace Core.Validators;

public class HikeShareReshareValidator : AbstractValidator<ReshareSharedHikeRequest>
{
    public HikeShareReshareValidator()
    {

        RuleFor(hsr => hsr.HikeIdentifier)
            .NotEmpty()
                .WithMessage("HikeIdentifier is required.")
            .Length(36)
                .WithMessage("HikeIdentifier must be at least 36 characters long.");
        RuleFor(hsr => hsr.ReShareToName)
            .NotEmpty()
                .WithMessage("Shared with Name is required.")
            .MaximumLength(20)
                .WithMessage("Shared with Name cannot exceed 20 characters.");
    }
}
