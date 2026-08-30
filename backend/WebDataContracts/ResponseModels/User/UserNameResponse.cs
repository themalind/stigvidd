// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.User;

public class UserNameResponse
{
    public string? Nickname { get; set; }
    public bool Exists { get; set; }

    public static UserNameResponse Create(string? Nickname, bool Exists)
    {
        return new UserNameResponse
        {
            Nickname = Nickname,
            Exists = Exists
        };
    }


}
