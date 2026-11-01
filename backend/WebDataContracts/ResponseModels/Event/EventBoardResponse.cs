// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Event;

public class EventBoardResponse
{
    // Only on the first page (no cursor); a pinned post also appears in Posts at its place in time. keep-comment: the app shows them on top
    public required IReadOnlyCollection<EventPostResponse> Pinned { get; set; }

    // Oldest first, like a chat. keep-comment: the order within one page
    public required IReadOnlyCollection<EventPostResponse> Posts { get; set; }

    public string? NextCursor { get; set; }
    public DateTime? LastReadPostAt { get; set; }
    public bool Muted { get; set; }
}

public class EventPostResponse
{
    public required string Identifier { get; set; }

    // Null for a deleted account. keep-comment: the app shows "borttagen användare"
    public string? AuthorIdentifier { get; set; }
    public string? AuthorNickName { get; set; }

    public required string Body { get; set; }
    public bool IsPinned { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? EditedAt { get; set; }
    public bool IsMine { get; set; }
    public bool CanEdit { get; set; }
    public bool CanDelete { get; set; }
}
