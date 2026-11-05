// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Friend;

public class FriendPublishedTrailResponse
{
    public required string Identifier { get; set; }
    public required string Name { get; set; }
    public decimal TrailLength { get; set; }
    public string City { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public DateTime PublishedAt { get; set; }
}
