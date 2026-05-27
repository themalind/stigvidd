using FluentValidation;
using WebDataContracts.RequestModels.Friend;

namespace Core.Validators.Friends;

public class SendFriendRequestRequestValidator : AbstractValidator<SendFriendRequestRequest>
{
    public SendFriendRequestRequestValidator()
    {
        RuleFor(x => x.ReceiverNickName)
            .NotEmpty()
                .WithMessage("Receiver nickname is required.")
            .MaximumLength(20)
                .WithMessage("Receiver nickname must not exceed 20 characters.");
    }
}
