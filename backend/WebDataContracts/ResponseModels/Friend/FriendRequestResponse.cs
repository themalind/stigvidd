// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Friend;

public class FriendRequestResponse
{
    public required string RequesterIdentifier { get; set; }
    public required string RequesterNickName { get; set; }
    public DateTime CreatedAt { get; set; }

    public static FriendRequestResponse Create(string requesterIdentifier, string requesterNickName, DateTime createdAt)
    {
        return new FriendRequestResponse
        {
            RequesterIdentifier = requesterIdentifier,
            RequesterNickName = requesterNickName,
            CreatedAt = createdAt
        };
    }
}
