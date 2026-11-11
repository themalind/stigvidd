// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Event;

public class EventInviteeResponse
{
    public required string UserIdentifier { get; set; }
    public required string NickName { get; set; }
    public string? InvitedByNickName { get; set; }
    public DateTime InvitedAt { get; set; }
}
