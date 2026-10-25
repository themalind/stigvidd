// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.HikeShare;

public class OutgoingHikeShareResponse
{
    public required string HikeIdentifier { get; set; }
    public required string HikeName { get; set; }
    public decimal HikeLength { get; set; }
    public int Duration { get; set; }
    public required string Coordinates { get; set; }
    public bool IsOwnHike { get; set; }
    public string? ImageUrl { get; set; }
    public DateTime LastSharedAt { get; set; }
    public List<OutgoingHikeShareRecipientResponse> Recipients { get; set; } = [];
}

public class OutgoingHikeShareRecipientResponse
{
    public required string Identifier { get; set; }
    public required string NickName { get; set; }
    public DateTime SharedAt { get; set; }
}
