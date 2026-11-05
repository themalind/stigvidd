// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Projections.HikeShares;

public class SentHikeShareRecipient
{
    public required string Identifier { get; init; }
    public required string NickName { get; init; }
    public DateTime SharedAt { get; init; }
}
