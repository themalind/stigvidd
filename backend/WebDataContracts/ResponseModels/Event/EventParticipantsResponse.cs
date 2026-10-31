// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Event;

public class EventParticipantsResponse
{
    public int ParticipantCount { get; set; }
    public int InterestedCount { get; set; }

    // Null for anyone who has not joined: a per-viewer list without blocked users would reveal the block. keep-comment: counts only for outsiders
    public IReadOnlyCollection<EventParticipantResponse>? Participants { get; set; }

    // Pending invitations, null like Participants; the app leaves these out of the invite picker and revokes from here. keep-comment: why the list is here
    public IReadOnlyCollection<EventInviteeResponse>? Invited { get; set; }
}

public class EventParticipantResponse
{
    public required string UserIdentifier { get; set; }
    public required string NickName { get; set; }
    public required string Role { get; set; }
    public DateTime JoinedAt { get; set; }
}
