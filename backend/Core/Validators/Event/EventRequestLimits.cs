// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Validators.Event;

public static class EventRequestLimits
{
    public const int Title = 80;
    public const int Description = 2000;
    public const int PlaceName = 100;

    // The organizer takes a spot, so 1 would leave room for nobody else. keep-comment: why the minimum is 2
    public const int MinParticipants = 2;
    public const int MaxParticipants = 500;

    // An invitation can come from a stranger, so one request reaches only a few. keep-comment: per-request half of the invite cap; the daily half is EventLimits
    public const int InvitesPerRequest = 20;

    public const int PostBody = 1000;

    // Bounds PastAfter, so an event cannot sit in the feed for years or escape retention. keep-comment: why times have an upper limit
    public static readonly TimeSpan MaxLeadTime = TimeSpan.FromDays(365);
    public static readonly TimeSpan MaxDuration = TimeSpan.FromDays(14);
}
