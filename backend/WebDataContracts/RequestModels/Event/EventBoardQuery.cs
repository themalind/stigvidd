// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.Event;

public class EventBoardQuery
{
    public const int DefaultLimit = 30;
    public const int MaxLimit = 50;

    public int Limit { get; set; } = DefaultLimit;

    // Pages backwards: the next cursor gives the posts before the oldest one returned. keep-comment: the board opens at the newest post
    public string? Cursor { get; set; }
}
