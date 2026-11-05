// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Friend;

public class FriendProfileResponse
{
    public List<FriendReviewResponse> Reviews { get; set; } = [];
    public List<FriendPublishedTrailResponse> PublishedTrails { get; set; } = [];
}
