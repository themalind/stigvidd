// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Event;

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
