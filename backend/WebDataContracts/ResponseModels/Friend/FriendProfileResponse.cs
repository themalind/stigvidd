// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Friend;

public class FriendProfileResponse
{
    public List<FriendReviewResponse> Reviews { get; set; } = [];
    public List<FriendPublishedTrailResponse> PublishedTrails { get; set; } = [];
}

public class FriendReviewResponse
{
    public required string Identifier { get; set; }
    public required string TrailIdentifier { get; set; }
    public required string TrailName { get; set; }
    public decimal Rating { get; set; }
    public string? Text { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class FriendPublishedTrailResponse
{
    public required string Identifier { get; set; }
    public required string Name { get; set; }
    public decimal TrailLength { get; set; }
    public string City { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public DateTime PublishedAt { get; set; }
}
