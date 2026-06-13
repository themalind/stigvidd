using FluentValidation;
using WebDataContracts.RequestModels.PushToken;

namespace Core.Validators.PushToken;

public class RegisterPushTokenRequestValidator : AbstractValidator<RegisterPushTokenRequest>
{
    public RegisterPushTokenRequestValidator()
    {
        RuleFor(x => x.ExpoToken)
            .NotEmpty()
                .WithMessage("Expo token is required.")
            .MaximumLength(255).WithMessage("Expo token must not exceed 255 characters.");
        RuleFor(x => x.Platform)
            .NotEmpty()
                .WithMessage("Platform is required.")
            .Must(p => p.Equals("ios", StringComparison.OrdinalIgnoreCase) || p.Equals("android", StringComparison.OrdinalIgnoreCase))
            .WithMessage("Platform must be either 'ios' or 'android'.");
    }
}
