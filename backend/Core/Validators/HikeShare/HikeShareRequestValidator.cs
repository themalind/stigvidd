using FluentValidation;
using WebDataContracts.RequestModels.HikeShare;

namespace Core.Validators.HikeShare;

public class HikeShareRequestValidator : AbstractValidator<HikeShareRequest>
{
    public HikeShareRequestValidator()
    {
        RuleFor(hsr => hsr.HikeIdentifier)
            .NotEmpty()
                .WithMessage("HikeIdentifier is required.")
            .Length(36)
                .WithMessage("HikeIdentifier must be at least 36 characters long.");
        RuleFor(hsr => hsr.SharedWithName)
            .NotEmpty()
                .WithMessage("Shared with Name is required.")
            .MaximumLength(20)
                .WithMessage("Shared with Name cannot exceed 20 characters.");
    }
}
