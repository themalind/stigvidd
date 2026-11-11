// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

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
