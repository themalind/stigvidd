// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.Event;

public class EventRoleRequest
{
    // CoHost or Participant; the organizer role only changes hands through a hand-over. keep-comment: why Organizer is not accepted
    public required string Role { get; set; }
}

public class EventMuteRequest
{
    public bool Muted { get; set; }
}

public class EventInviteRequest
{
    public required List<string> NickNames { get; set; }
}
