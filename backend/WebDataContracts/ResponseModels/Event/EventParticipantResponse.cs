// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Event;

public class EventParticipantResponse
{
    public required string UserIdentifier { get; set; }
    public required string NickName { get; set; }
    public required string Role { get; set; }
    public DateTime JoinedAt { get; set; }
}
