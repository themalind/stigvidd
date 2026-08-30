// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Friend;

public class OutgoingFriendRequestResponse
{
    public required string ReceiverIdentifier { get; set; }
    public required string ReceiverNickName { get; set; }
    public DateTime CreatedAt { get; set; }

    public static OutgoingFriendRequestResponse Create(string receiverIdentifier, string receiverNickName, DateTime createdAt)
    {
        return new OutgoingFriendRequestResponse
        {
            ReceiverIdentifier = receiverIdentifier,
            ReceiverNickName = receiverNickName,
            CreatedAt = createdAt
        };
    }
}