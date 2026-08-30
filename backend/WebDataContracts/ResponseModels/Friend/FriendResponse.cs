// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Friend;

public class FriendResponse
{
    public required string Identifier { get; set; }
    public required string NickName { get; set; }

    public static FriendResponse Create(string identifier, string nickName)
    {
        return new FriendResponse
        {
            Identifier = identifier,
            NickName = nickName
        };
    }
}
