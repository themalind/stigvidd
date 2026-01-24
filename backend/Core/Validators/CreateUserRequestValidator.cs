using FluentValidation;
using WebDataContracts.RequestModels.User;

namespace Core.Validators;

public class CreateUserRequestValidator : AbstractValidator<CreateUserRequest>
{
    public CreateUserRequestValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email is required.")
            .EmailAddress().WithMessage("Invalid email format.");
        RuleFor(x => x.NickName)
            .NotEmpty().WithMessage("NickName is required.")
            .MaximumLength(20).WithMessage("NickName cannot exceed 20 characters.");
    }
}
