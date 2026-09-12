// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.ContentReport;

// One row in the Authors tab. Strikes count distinct content, not reports.
public class AuthorStatisticResponse
{
    public string? NickName { get; set; }
    public int Strikes { get; set; }

    public static AuthorStatisticResponse Create(string? nickName, int strikes)
    {
        return new AuthorStatisticResponse
        {
            NickName = nickName,
            Strikes = strikes
        };
    }
}
