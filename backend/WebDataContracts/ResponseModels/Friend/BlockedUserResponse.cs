// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Friend;

public class BlockedUserResponse
{
    public required string Identifier { get; set; }
    public required string NickName { get; set; }
    public required DateTime BlockedAt { get; set; }

    public static BlockedUserResponse Create(string identifier, string nickName, DateTime blockedAt)
    {
        return new BlockedUserResponse
        {
            Identifier = identifier,
            NickName = nickName,
            BlockedAt = blockedAt
        };
    }
}
