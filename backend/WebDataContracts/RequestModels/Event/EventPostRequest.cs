// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.Event;

public class EventPostRequest
{
    public required string Body { get; set; }
    public Guid? ClientRequestId { get; set; }
}

public class EventPostPinRequest
{
    public bool Pinned { get; set; }
}

public class EventPostsReadRequest
{
    // The CreatedAt of the newest post the app has shown; the marker only moves forward. keep-comment: never the device clock
    public DateTime ReadUpTo { get; set; }
}

public class EventBoardQuery
{
    public const int DefaultLimit = 30;
    public const int MaxLimit = 50;

    public int Limit { get; set; } = DefaultLimit;

    // Pages backwards: the next cursor gives the posts before the oldest one returned. keep-comment: the board opens at the newest post
    public string? Cursor { get; set; }
}
