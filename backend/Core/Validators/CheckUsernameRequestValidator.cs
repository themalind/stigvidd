using FluentValidation;
using WebDataContracts.RequestModels.User;

namespace Core.Validators;

public class CheckUsernameRequestValidator : AbstractValidator<CheckUsernameRequest>
{
    public CheckUsernameRequestValidator()
    {
        RuleFor(u => u.Username)
            .NotEmpty()
            .MaximumLength(20);
    }
}
