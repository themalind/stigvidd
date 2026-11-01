// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Services.Push;

// The app routes taps on these values; renaming one breaks installed apps. keep-comment: contract with shipped clients
public static class PushTypes
{
    public const string FriendRequest = "friend_request";
    public const string FriendRequestAccepted = "friend_request_accepted";
    public const string HikeShare = "hike_share";
    public const string EventCancelled = "event_cancelled";
    public const string EventUpdated = "event_updated";
    public const string EventPromoted = "event_promoted";
    public const string EventInvite = "event_invite";
    public const string EventPost = "event_post";
}
