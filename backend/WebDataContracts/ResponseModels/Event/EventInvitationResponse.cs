// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Event;

public class EventInvitationResponse
{
    public required EventSummaryResponse Event { get; set; }

    // Null when the inviter deleted their account or is someone the viewer blocked. keep-comment: two reasons a reader cannot see
    public string? InvitedByNickName { get; set; }

    public DateTime InvitedAt { get; set; }
}
