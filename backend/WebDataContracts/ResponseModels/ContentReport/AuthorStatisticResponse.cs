// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.ContentReport;

// One row in the Authors tab. Strikes count distinct content, not reports.
public class AuthorStatisticResponse
{
    // Null once the account is deleted, which is also when there is nothing left to ban.
    public string? Identifier { get; set; }
    public string? NickName { get; set; }
    public int Strikes { get; set; }

    // Null while the account can still write; the row offers Ban or Lift ban on it.
    public DateTime? BannedAt { get; set; }

    public int BanCount { get; set; }

    public static AuthorStatisticResponse Create(string? identifier, string? nickName, int strikes, DateTime? bannedAt, int banCount)
    {
        return new AuthorStatisticResponse
        {
            Identifier = identifier,
            NickName = nickName,
            Strikes = strikes,
            BannedAt = bannedAt,
            BanCount = banCount
        };
    }
}
